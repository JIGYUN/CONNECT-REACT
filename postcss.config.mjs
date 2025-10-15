// postcss.config.mjs  (Tailwind v4 권장 형태)
export default {
  plugins: {
    '@tailwindcss/postcss': {},  // ← v4에서 필요한 공식 PostCSS 플러그인
    autoprefixer: {},            // 선택이지만 함께 두어도 OK
  },
};