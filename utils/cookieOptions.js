// Utility to generate secure, production-ready Cookie options

const getCookieOptions = (extraOptions = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  const baseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days default
    ...extraOptions
  };

  if (isProduction && cookieDomain) {
    baseOptions.domain = cookieDomain;
  }

  return baseOptions;
};

const getClearCookieOptions = (extraOptions = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  const baseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    ...extraOptions
  };

  if (isProduction && cookieDomain) {
    baseOptions.domain = cookieDomain;
  }

  return baseOptions;
};

module.exports = {
  getCookieOptions,
  getClearCookieOptions
};
