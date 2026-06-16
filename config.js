// Frontend runtime config (no secrets here).
const config = {
  BACKEND_BASE_URL: "http://localhost:8080",
  BACKEND_API_URL: "http://localhost:8080/api/chat",
  AUTH_LOGIN_URL: "http://localhost:8080/api/auth/login",
  AUTH_REGISTER_URL: "http://localhost:8080/api/auth/register",
  ME_URL: "http://localhost:8080/api/me",
  AVATAR_UPLOAD_URL: "http://localhost:8080/api/me/avatar",
  USAGE_URL: "http://localhost:8080/api/usage",
};

export default config;
