import './globals.css'

export const metadata = {
  title: 'Wellness Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
