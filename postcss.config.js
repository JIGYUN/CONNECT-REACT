// Tailwind v4용 안전한 CJS 구성
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // ← v4 공식 PostCSS 플러그인
    autoprefixer: {}
  }
};