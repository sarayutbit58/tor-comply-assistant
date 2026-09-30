import './globals.css';
import '@/components/ai.css';
import {AiSessionBoundary} from '@/components/AiSettings';

export const metadata = {
  title: 'TOR Comply | 1toAll',
  description: 'เช็กลิสต์และตาราง Comply TOR สำหรับ Presales พร้อมหลักฐานที่ตรวจสอบได้',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return <html lang="th"><body><AiSessionBoundary>{children}</AiSessionBoundary></body></html>;
}
