import Link from 'next/link';
import { Home, Scan, Library } from 'lucide-react'; // Icônes standards

export default function TabBar() {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-app-purple/20 backdrop-blur-lg border border-app-purple/30 rounded-full px-8 py-4 z-50">
      <ul className="flex justify-between items-center">
        <li>
          <Link href="/" className="text-white hover:text-app-neon transition-colors">
            <Home size={24} />
          </Link>
        </li>
        <li>
          <Link href="/scanner" className="bg-app-neon text-black p-3 rounded-full flex items-center justify-center shadow-lg shadow-app-neon/20 hover:scale-110 transition-transform">
            <Scan size={28} />
          </Link>
        </li>
        <li>
          <Link href="/collection" className="text-white hover:text-app-neon transition-colors">
            <Library size={24} />
          </Link>
        </li>
      </ul>
    </nav>
  );
}