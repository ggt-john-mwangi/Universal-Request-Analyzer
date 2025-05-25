import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Network, ShieldCheck, UserCircle, LogOut } from 'lucide-react';
import { Button } from '../ui/button';

const Navbar = ({ user = null, handleLogout = () => {} }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full bg-white/95 dark:bg-[#0a0a0a]/95 border-b border-brand-purple/20 dark:border-[#22223b] fixed top-0 left-0 z-50 backdrop-blur-md"
    >
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Network className="h-8 w-8 text-brand-accent" />
          <span className="font-bold text-lg text-brand-purple">
            Universal Request Analyzer
          </span>
        </Link>
        <button
          className="md:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-[#4A00E0]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        <div className={`md:flex gap-6 items-center ${open ? "block" : "hidden"} absolute md:static top-14 left-0 w-full md:w-auto bg-white/95 dark:bg-[#0a0a0a]/95 md:bg-transparent md:dark:bg-transparent shadow md:shadow-none`}> 
          <Link href="/#features" className="block px-4 py-2 md:p-0 hover:text-[#4A00E0]">Features</Link>
          <Link href="/#pricing" className="block px-4 py-2 md:p-0 hover:text-[#4A00E0]">Pricing</Link>
          {user ? (
            <>
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <Button variant="ghost" className="text-foreground hover:text-brand-accent transition-colors" asChild>
                  <Link href="/dashboard/admin"><ShieldCheck className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Admin</Link>
                </Button>
              )}
              <Button variant="ghost" className="text-foreground hover:text-brand-accent transition-colors" asChild>
                <Link href="/dashboard"><UserCircle className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Dashboard</Link>
              </Button>
              <Button 
                onClick={handleLogout} 
                className="bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors shadow-md text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
              >
                <LogOut className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-foreground hover:text-brand-accent transition-colors" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button className="bg-gradient-to-r from-brand-purple via-brand-blue to-brand-accent text-white font-semibold hover:opacity-90 transition-opacity shadow-md text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2" asChild>
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;