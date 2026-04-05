import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "カタン初期配置トレーナー",
  description: "カタンの初期配置を練習するトレーニングアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
