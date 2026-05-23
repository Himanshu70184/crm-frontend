import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { BrandingProvider } from '@/context/BrandingContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CRM – Project & Task Management',
  description: 'IT Company CRM System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BrandingProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          </AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
