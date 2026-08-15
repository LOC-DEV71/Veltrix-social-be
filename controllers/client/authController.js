const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../../models/User');
const Ban = require('../../models/Ban');
const OTP = require('../../models/OTP');
const { getCookieOptions, getClearCookieOptions } = require('../../utils/cookieOptions');
const { sendWelcomeEmail, sendOTPEmail } = require('../../utils/sendEmail');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { username, email, password, otpCode } = req.body;

    if (!username || !email || !password || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: username, email, password và mã OTP.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otpCode.trim();

    // Verify OTP record
    const otpRecord = await OTP.findOne({ email: cleanEmail, code: cleanOtp });
    if (!otpRecord || new Date() > new Date(otpRecord.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn 5 phút. Vui lòng lấy mã mới!'
      });
    }


    // Check if IP is banned
    const clientIp = req.ip || req.connection.remoteAddress;
    const ipBan = await Ban.findOne({ ipAddress: clientIp });
    if (ipBan) {
      res.cookie('isBanned', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banReason', encodeURIComponent(ipBan.reason), { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banType', ipBan.banType, { maxAge: 365 * 24 * 60 * 60 * 1000 });
      
      return res.status(403).json({
        success: false,
        isBanned: true,
        banType: ipBan.banType,
        reason: ipBan.reason,
        message: `Địa chỉ IP của bạn đã bị cấm. Lý do: ${ipBan.reason}`
      });
    }

    // Check if email already in use
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được sử dụng bởi tài khoản khác!'
      });
    }

    // Check if username already exists
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: 'Tên người dùng (username) này đã tồn tại!'
      });
    }

    // Hash the password with bcrypt salt rounds
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new User in database
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      coins: 500,
      isPremium: false,
      role: 'user',
      isBanned: false,
      lastIp: clientIp,
      ownedFrames: [],
      activeFrame: null
    });

    // Delete OTP record after successful registration
    await OTP.deleteMany({ email: cleanEmail });

    // Send welcome email via Resend in background
    sendWelcomeEmail({ toEmail: newUser.email, username: newUser.username }).catch(err => {
      console.error('Non-blocking welcome email failed:', err);
    });


    // Create access JWT token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '30d' }
    );

    // Clear any leftover ban cookies
    res.clearCookie('isBanned');
    res.clearCookie('banReason');
    res.clearCookie('banType');

    // Set clientToken inside HttpOnly cookie
    res.cookie('clientToken', token, getCookieOptions());


    res.status(201).json({
      status: 'success', // Updated to match frontend expectations
      success: true,
      message: 'Đăng ký tài khoản mới thành công!',
      token: token,
      data: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        coins: newUser.coins,
        isPremium: newUser.isPremium
      }
    });

  } catch (error) {
    console.error(`🔴 Auth Register Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi khởi tạo tài khoản mới!'
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ cả Email và Mật khẩu!'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check Ban list
    const clientIp = req.ip || req.connection.remoteAddress;
    const isBanned = await Ban.findOne({ $or: [{ email: cleanEmail }, { ipAddress: clientIp }] });
    if (isBanned) {
      res.cookie('isBanned', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banReason', encodeURIComponent(isBanned.reason), { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banType', isBanned.banType, { maxAge: 365 * 24 * 60 * 60 * 1000 });
      
      return res.status(403).json({
        success: false,
        isBanned: true,
        banType: isBanned.banType,
        reason: isBanned.reason,
        message: `Tài khoản hoặc IP này đã bị cấm. Lý do: ${isBanned.reason}`
      });
    }

    // Find User and populate frames
    const user = await User.findOne({ email: cleanEmail })
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate')
      .populate('ownedProfileEffects')
      .populate('activeProfileEffect');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc Mật khẩu không chính xác!'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản này tạo bằng Google. Vui lòng bấm nút "Đăng nhập bằng Google"!'
      });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc Mật khẩu không chính xác!'
      });
    }

    // Update last IP
    user.lastIp = clientIp;
    await user.save();

    // Sign JWT access token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '30d' }
    );

    // Clear any leftover ban cookies
    res.clearCookie('isBanned');
    res.clearCookie('banReason');
    res.clearCookie('banType');

    // Set clientToken inside HttpOnly cookie
    res.cookie('clientToken', token, getCookieOptions());

    res.status(200).json({
      status: 'success', // Updated to match frontend expectations
      success: true,
      message: `Chào mừng quay trở lại, ${user.username}!`,
      token: token,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        coins: user.coins,
        isPremium: user.isPremium,
        ownedFrames: user.ownedFrames,
        activeFrame: user.activeFrame,
        ownedNameplates: user.ownedNameplates,
        activeNameplate: user.activeNameplate,
        ownedProfileEffects: user.ownedProfileEffects,
        activeProfileEffect: user.activeProfileEffect,
        avatar: user.avatar,
        bannerColor: user.bannerColor,
        bannerImage: user.bannerImage
      }
    });

  } catch (error) {
    console.error(`🔴 Auth Login Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi xử lý đăng nhập!'
    });
  }
};

// @desc    Get fresh profile details for authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ!'
      });
    }

    // Fetch fresh profile details from DB with populated items
    const user = await User.findById(req.user._id || req.user.id)
      .select('-password')
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate')
      .populate('ownedProfileEffects')
      .populate('activeProfileEffect');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin tài khoản người dùng!'
      });
    }

    // Lazy evaluation for custom status expiration
    if (user.customStatus && user.customStatus.expiresAt && new Date(user.customStatus.expiresAt) < new Date()) {
      user.customStatus = { text: null, emoji: null, expiresAt: null, updatedAt: null };
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      success: true,
      data: user
    });
  } catch (error) {
    console.error(`🔴 Get Fresh User Profile Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tải thông tin tài khoản cá nhân!'
    });
  }
};

// @desc    Logout client user
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  res.clearCookie('clientToken', getClearCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Đăng xuất tài khoản người dùng thành công!'
  });
};

// @desc    Update user profile settings
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn!'
      });
    }

    const { displayName, pronouns, bannerColor, activeFrame, activeNameplate, activeProfileEffect, customStatus, username, removeBanner, removeAvatar, themePrimary, themeAccent } = req.body;

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (username && username !== user.username) {
      if (username.length < 3) {
        return res.status(400).json({ success: false, message: 'Tên người dùng phải có ít nhất 3 ký tự.' });
      }
      
      // Check cooldown (30 days)
      if (user.lastUsernameUpdate) {
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const timeSinceLastUpdate = Date.now() - new Date(user.lastUsernameUpdate).getTime();
        if (timeSinceLastUpdate < THIRTY_DAYS) {
          const daysLeft = Math.ceil((THIRTY_DAYS - timeSinceLastUpdate) / (1000 * 60 * 60 * 24));
          return res.status(400).json({ success: false, message: `Bạn chỉ được đổi tên người dùng 1 lần trong 30 ngày. Vui lòng thử lại sau ${daysLeft} ngày.` });
        }
      }

      // Check duplicate
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Tên người dùng này đã có người sử dụng!' });
      }

      user.username = username;
      user.lastUsernameUpdate = new Date();
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (bannerColor !== undefined) user.bannerColor = bannerColor;
    
    if (user.isPremium) {
      if (themePrimary !== undefined || themeAccent !== undefined) {
        user.themeColors = {
          primary: themePrimary !== undefined ? themePrimary : user.themeColors?.primary,
          accent: themeAccent !== undefined ? themeAccent : user.themeColors?.accent,
        };
      }
    }
    
    // Client có thể gửi id là chuỗi rỗng khi bỏ trang trí, nên ta parse null
    if (activeFrame !== undefined) {
      user.activeFrame = activeFrame || null; 
      if (user.activeFrame) {
        const Product = require('../../models/Product');
        const frame = await Product.findById(user.activeFrame);
        if (frame) {
          user.activeFrameStaticUrl = frame.staticUrl || null;
          user.activeFrameAnimatedUrl = frame.animatedUrl || null;
        }
      } else {
        user.activeFrameStaticUrl = null;
        user.activeFrameAnimatedUrl = null;
      }
    }
    
    if (activeNameplate !== undefined) {
      user.activeNameplate = activeNameplate || null; 
      if (user.activeNameplate) {
        const Product = require('../../models/Product');
        const nameplate = await Product.findById(user.activeNameplate);
        if (nameplate) {
          user.activeNameplateStaticUrl = nameplate.staticUrl || null;
          user.activeNameplateAnimatedUrl = nameplate.animatedUrl || null;
        }
      } else {
        user.activeNameplateStaticUrl = null;
        user.activeNameplateAnimatedUrl = null;
      }
    }
    
    if (activeProfileEffect !== undefined) {
      user.activeProfileEffect = activeProfileEffect || null; 
      if (user.activeProfileEffect) {
        const Product = require('../../models/Product');
        const effect = await Product.findById(user.activeProfileEffect);
        if (effect) {
          user.activeProfileEffectStaticUrl = effect.staticUrl || null;
          user.activeProfileEffectAnimatedUrl = effect.animatedUrl || null;
          user.activeProfileEffectLayers = effect.effectLayers || [];
        }
      } else {
        user.activeProfileEffectStaticUrl = null;
        user.activeProfileEffectAnimatedUrl = null;
        user.activeProfileEffectLayers = [];
      }
    }
    
    if (customStatus !== undefined) {
      if (customStatus === null) {
        user.customStatus = { text: null, emoji: null, expiresAt: null, updatedAt: null };
      } else {
        user.customStatus = {
          text: customStatus.text || null,
          emoji: customStatus.emoji || null,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
      }
    }

    if (req.files && req.files['avatarFile']) {
      user.avatar = req.files['avatarFile'][0].path; // Cloudinary URL
    }

    if (removeAvatar === 'true' || removeAvatar === true) {
      user.avatar = null;
    }

    if (req.files && req.files['bannerFile']) {
      // Allow only premium users to upload banner
      if (user.isPremium) {
        user.bannerImage = req.files['bannerFile'][0].path;
      }
    }

    if (removeBanner === 'true' || removeBanner === true) {
      user.bannerImage = null;
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate')
      .populate('ownedProfileEffects')
      .populate('activeProfileEffect');

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Cập nhật hồ sơ thành công!',
      data: updatedUser
    });
  } catch (error) {
    console.error(`🔴 Update Profile Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật hồ sơ!'
    });
  }
};

// @desc    Authenticate/Register user via Google OAuth Credential Token
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Google Credential token!'
      });
    }

    // Check IP ban
    const clientIp = req.ip || req.connection.remoteAddress;
    const ipBan = await Ban.findOne({ ipAddress: clientIp });
    if (ipBan) {
      res.cookie('isBanned', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banReason', encodeURIComponent(ipBan.reason), { maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie('banType', ipBan.banType, { maxAge: 365 * 24 * 60 * 60 * 1000 });
      return res.status(403).json({
        success: false,
        isBanned: true,
        banType: ipBan.banType,
        reason: ipBan.reason,
        message: `Địa chỉ IP của bạn đã bị cấm. Lý do: ${ipBan.reason}`
      });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID || undefined,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('Google verifyIdToken SDK warning, attempting HTTP tokeninfo fallback:', verifyErr.message);
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!response.ok) {
        return res.status(401).json({
          success: false,
          message: 'Xác thực Google Token không hợp lệ hoặc đã hết hạn!'
        });
      }
      payload = await response.json();
    }

    const { email, sub: googleId, name, picture } = payload;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Không thể lấy thông tin Email từ tài khoản Google!'
      });
    }

    // Check if email is banned
    const emailBan = await Ban.findOne({ email });
    if (emailBan) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        reason: emailBan.reason,
        message: `Tài khoản (${email}) đã bị cấm. Lý do: ${emailBan.reason}`
      });
    }

    let user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { googleId }] })
      .populate('ownedFrames')
      .populate('activeFrame')
      .populate('ownedNameplates')
      .populate('activeNameplate')
      .populate('ownedProfileEffects')
      .populate('activeProfileEffect');

    if (!user) {
      // Auto generate a clean unique username
      let baseUsername = (name || email.split('@')[0])
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
        .slice(0, 15);
      if (baseUsername.length < 3) baseUsername = 'user' + baseUsername;

      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${Math.floor(100 + Math.random() * 900)}`;
        counter++;
        if (counter > 50) break;
      }

      user = await User.create({
        username: uniqueUsername,
        displayName: name || uniqueUsername,
        email: email.toLowerCase(),
        googleId,
        avatar: picture || null,
        coins: 500,
        isPremium: false,
        role: 'user',
        isBanned: false,
        lastIp: clientIp,
        ownedFrames: [],
        activeFrame: null
      });

      user = await User.findById(user._id)
        .populate('ownedFrames')
        .populate('activeFrame')
        .populate('ownedNameplates')
        .populate('activeNameplate')
        .populate('ownedProfileEffects')
        .populate('activeProfileEffect');

      // Send welcome email via Resend in background
      sendWelcomeEmail({ toEmail: user.email, username: user.username, displayName: user.displayName }).catch(err => {
        console.error('Non-blocking Google welcome email failed:', err);
      });
    } else {
      let isUpdated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        isUpdated = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        isUpdated = true;
      }
      user.lastIp = clientIp;
      if (isUpdated) {
        await user.save();
      }
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '30d' }
    );

    res.clearCookie('isBanned');
    res.clearCookie('banReason');
    res.clearCookie('banType');

    res.cookie('clientToken', token, getCookieOptions());


    res.status(200).json({
      status: 'success',
      success: true,
      message: `Đăng nhập Google thành công! Chào mừng ${user.displayName || user.username}.`,
      token: token,
      data: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        coins: user.coins,
        isPremium: user.isPremium,
        ownedFrames: user.ownedFrames,
        activeFrame: user.activeFrame,
        ownedNameplates: user.ownedNameplates,
        activeNameplate: user.activeNameplate,
        ownedProfileEffects: user.ownedProfileEffects,
        activeProfileEffect: user.activeProfileEffect,
        avatar: user.avatar,
        bannerColor: user.bannerColor,
        bannerImage: user.bannerImage
      }
    });

  } catch (error) {
    console.error(`🔴 Google Auth Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi xử lý đăng nhập bằng Google!'
    });
  }
};

// @desc    Send 6-digit OTP code to email for verification
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email!'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email is already registered in User model
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ email này đã được đăng ký cho tài khoản khác!'
      });
    }

    // Clear old OTPs for this email first (preventing duplicates/stale records)
    await OTP.deleteMany({ email: cleanEmail });

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save new OTP record (expires in 5 minutes)
    await OTP.create({
      email: cleanEmail,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send OTP email via Resend
    sendOTPEmail({ toEmail: cleanEmail, otpCode }).catch(err => {
      console.error('Non-blocking OTP email failed:', err);
    });

    res.status(200).json({
      status: 'success',
      success: true,
      message: `Đã gửi mã OTP 6 chữ số tới email ${cleanEmail}. Mã có hiệu lực trong 5 phút!`
    });

  } catch (error) {
    console.error(`🔴 Send OTP Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi gửi mã OTP!'
    });
  }
};

// @desc    Verify 6-digit OTP code
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ email và mã OTP!'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    const otpRecord = await OTP.findOne({ email: cleanEmail, code: cleanCode });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác hoặc đã quá hạn 5 phút!'
      });
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn 5 phút. Vui lòng gửi lại mã mới!'
      });
    }

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Mã OTP chính xác!'
    });

  } catch (error) {
    console.error(`🔴 Verify OTP Controller Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi kiểm tra mã OTP!'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  updateProfile,
  googleLogin,
  sendOTP,
  verifyOTP
};

