module.exports = {
  PORT: process.env.PORT || 4000,
  // In a real deployment, set JWT_SECRET as an environment variable instead of using this default.
  JWT_SECRET: process.env.JWT_SECRET || 'onboardops-dev-secret-change-me',
  JWT_EXPIRES_IN: '8h',
  SCORING: {
    HINT_PENALTY: 5,
    DISTRACTOR_PENALTY: 3,
    PRIVILEGE_PENALTY: 3,
    COMPLETION_BONUS: 30
  }
};
