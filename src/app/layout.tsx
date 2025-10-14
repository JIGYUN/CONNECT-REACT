/* filepath: src/app/layout.tsx */
import '../styles/globals.css';
import Providers from './providers';
import NavMenu from '@/shared/ui/NavMenu';

export const metadata = {
  title: 'CONNECT',
  description: 'CONNECT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Providers>
          {/* ✅ 헤더: 좌 햄버거 · 중앙 CONNECT · 우측 여유(대칭) */}
          <header className="app-header">
            <div className="app-header__inner">
              <NavMenu />                              {/* 좌측: 햄버거 */}
              <a href="/" className="app-logo">CONNECT</a>  {/* 중앙: 로고 */}
              <div className="app-header__spacer" />  {/* 우측: 대칭용 빈칸 */}
            </div>
          </header>
          <main className="app-main">{children}</main>

          <footer className="footer">
            <div className="footer__inner">
              <small>© {new Date().getFullYear()} CONNECT · v1</small>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}