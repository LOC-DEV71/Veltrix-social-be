const { Resend } = require('resend');
const nodemailer = require('nodemailer');

const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Gmail Nodemailer Transporter option (for testing without domain restrictions)
const gmailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
const gmailPass = process.env.EMAIL_PASS || process.env.GMAIL_PASS;

const nodemailerTransporter = (gmailUser && gmailPass)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    })
  : null;

/**
 * Universal Email Sender Helper (Supports both Nodemailer/Gmail & Resend API)
 */
const sendMailInternal = async ({ toEmail, subject, html }) => {
  // Option 1: Use Nodemailer with Gmail if EMAIL_PASS is set (allows ANY recipient during local dev)
  if (nodemailerTransporter && gmailUser) {
    try {
      const info = await nodemailerTransporter.sendMail({
        from: `"Vetrix Social" <${gmailUser}>`,
        to: toEmail,
        subject,
        html
      });
      console.log('🟢 Email sent via Nodemailer (Gmail) successfully to:', toEmail, info.messageId);
      return { success: true, data: info };
    } catch (err) {
      console.error('🔴 Nodemailer Gmail Error:', err.message);
    }
  }

  // Option 2: Use Resend API
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Vetrix Social <onboarding@resend.dev>',
        to: [toEmail],
        subject,
        html
      });

      if (error) {
        console.error('🔴 Resend API Error:', error);
        if (error.message && error.message.includes('only send testing emails')) {
          console.warn('⚠️ Ghi chú Resend: Tài khoản Resend chưa verify tên miền veltrixvoice.autos chỉ cho phép gửi test về lamchilocwork5@gmail.com. Hãy thử bằng email lamchilocwork5@gmail.com hoặc thêm EMAIL_PASS Gmail App Password vào .env!');
        }
        return { success: false, error };
      }

      console.log('🟢 Email sent via Resend successfully to:', toEmail, data);
      return { success: true, data };
    } catch (err) {
      console.error('🔴 Exception in Resend Email:', err.message);
      return { success: false, error: err.message };
    }
  }

  console.warn('⚠️ No active Mail Transporter (Resend or Gmail App Password) configured in .env.');
  return { success: false, message: 'No Mail Transporter configured' };
};

/**
 * Send ultra-modern HTML welcome email to newly registered or Google OAuth signed-up users
 */
const sendWelcomeEmail = async ({ toEmail, username, displayName }) => {
  const name = displayName || username;
  const subject = '✨ Chào mừng tân thủ gia nhập Vetrix Social!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0c0e; padding: 40px 10px;">
        <tr>
          <td align="center">
            <!-- Main Container Card -->
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #17181c; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
              
              <!-- Top Colorful Gradient Line -->
              <tr>
                <td style="height: 4px; background: linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>

              <!-- Header Info -->
              <tr>
                <td style="padding: 36px 32px 20px 32px; text-align: center;">
                  <span style="display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; color: #818cf8; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px;">
                    ✨ WELCOME TO VETRIX SOCIAL
                  </span>
                  <h1 style="margin: 10px 0 6px 0; color: #ffffff; font-size: 26px; font-weight: 900; tracking-tight: -0.5px;">VETRIX SOCIAL</h1>
                  <p style="margin: 0; color: #949ba4; font-size: 14px; font-weight: 500;">Nền tảng giao tiếp & trò chuyện thời gian thực thế hệ mới</p>
                </td>
              </tr>

              <!-- Main Content Area -->
              <tr>
                <td style="padding: 0 32px 32px 32px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    
                    <!-- Welcome Greeting Block -->
                    <tr>
                      <td style="background-color: #202227; border-radius: 12px; padding: 22px; border: 1px solid rgba(255, 255, 255, 0.05);">
                        <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                          Xin chào <span style="color: #c084fc;">${name}</span>! 👋
                        </h2>
                        <p style="margin: 0; color: #dbdee1; font-size: 14px; line-height: 1.6;">
                          Chúc mừng bạn đã khởi tạo thành công tài khoản tại <strong>Vetrix Social</strong>! Bạn hiện đã có thể sẵn sàng trò chuyện văn bản, thoại/video WebRTC chất lượng cao và kết nối bạn bè ngay lập tức.
                        </p>
                      </td>
                    </tr>

                    <tr><td style="height: 16px;"></td></tr>

                    <!-- Glowing Gift Reward Box -->
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 12px; padding: 20px;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="44" valign="top" style="font-size: 32px; line-height: 1;">🪙</td>
                            <td style="padding-left: 12px;">
                              <h3 style="margin: 0 0 4px 0; color: #facc15; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Quà Tặng Tân Thủ Khởi Tạo</h3>
                              <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.5;">
                                Tài khoản của bạn đã được nhận ngay <strong style="color: #facc15; font-size: 15px;">+500 Coins</strong> vào số dư. Hãy trải nghiệm ngay <strong>Shop Vật Phẩm</strong> để mua sắm Khung Avatar (Avatar Decor), Hiệu ứng hồ sơ và Theme cá tính!
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height: 20px;"></td></tr>

                    <!-- Feature Pills Grid -->
                    <tr>
                      <td>
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1b20; border-radius: 12px; padding: 14px; border: 1px solid rgba(255,255,255,0.04);">
                          <tr>
                            <td align="center" width="33%" style="padding: 6px;">
                              <div style="font-size: 22px; margin-bottom: 4px;">💬</div>
                              <div style="color: #ffffff; font-size: 12px; font-weight: 700;">Kênh Chat Real-time</div>
                            </td>
                            <td align="center" width="33%" style="padding: 6px; border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);">
                              <div style="font-size: 22px; margin-bottom: 4px;">🎙️</div>
                              <div style="color: #ffffff; font-size: 12px; font-weight: 700;">Voice Channel WebRTC</div>
                            </td>
                            <td align="center" width="33%" style="padding: 6px;">
                              <div style="font-size: 22px; margin-bottom: 4px;">🛍️</div>
                              <div style="color: #ffffff; font-size: 12px; font-weight: 700;">Cửa Hàng Vật Phẩm</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height: 28px;"></td></tr>

                    <!-- Call to Action Button -->
                    <tr>
                      <td align="center">
                        <a href="${process.env.FRONTEND_URL || 'https://veltrixvoice.autos'}" target="_blank" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 9999px; box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5); letter-spacing: 0.5px;">
                          TRUY CẬP VETRIX NGAY →
                        </a>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #121316; padding: 22px 32px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                  <p style="margin: 0 0 6px 0; color: #949ba4; font-size: 12px; font-weight: 500;">
                    Email này được tự động gửi từ hệ thống Vetrix Social.
                  </p>
                  <p style="margin: 0; color: #676e79; font-size: 11px;">
                    © 2026 Vetrix Social • <a href="https://veltrixvoice.autos" style="color: #818cf8; text-decoration: none;">veltrixvoice.autos</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMailInternal({ toEmail, subject, html });
};

/**
 * Send 6-digit OTP verification code email
 */
const sendOTPEmail = async ({ toEmail, otpCode }) => {
  const subject = `🔑 Mã xác thực OTP của bạn là: ${otpCode}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0c0e; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #17181c; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
              
              <tr>
                <td style="height: 4px; background: linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #6366f1 100%); font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>

              <tr>
                <td style="padding: 32px 32px 16px 32px; text-align: center;">
                  <span style="display: inline-block; padding: 6px 14px; background: rgba(236, 72, 153, 0.12); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 9999px; color: #f472b6; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                    🔑 MÃ XÁC THỰC ĐĂNG KÝ
                  </span>
                  <h1 style="margin: 8px 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 900;">VETRIX SOCIAL</h1>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 32px 32px 32px;">
                  <div style="background-color: #202227; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <p style="margin: 0 0 16px 0; color: #dbdee1; font-size: 14px; line-height: 1.5;">
                      Bạn vừa yêu cầu mã xác thực cho địa chỉ email <strong style="color: #ffffff;">${toEmail}</strong>. Nhập mã 6 chữ số dưới đây để tiếp tục:
                    </p>
                    
                    <!-- OTP Code Display Box -->
                    <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%); border: 2px dashed rgba(168, 85, 247, 0.5); border-radius: 12px; padding: 18px 24px; margin: 20px 0; display: inline-block;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #f472b6; text-shadow: 0 0 10px rgba(244, 114, 182, 0.4);">
                        ${otpCode}
                      </span>
                    </div>

                    <p style="margin: 16px 0 0 0; color: #949ba4; font-size: 12px;">
                      ⏱️ Mã xác thực này có hiệu lực trong <strong>5 phút</strong>.<br/>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #121316; padding: 18px 32px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                  <p style="margin: 0; color: #676e79; font-size: 11px;">
                    © 2026 Vetrix Social • <a href="https://veltrixvoice.autos" style="color: #818cf8; text-decoration: none;">veltrixvoice.autos</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMailInternal({ toEmail, subject, html });
};

module.exports = {
  sendWelcomeEmail,
  sendOTPEmail
};
