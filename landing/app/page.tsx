'use client';

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Hero from '@/components/sections/Hero';
import Features from '@/components/sections/Features';
import Pricing from '@/components/sections/Pricing';
import Testimonials from '@/components/sections/Testimonials';
import CallToAction from '@/components/sections/CallToAction';
import Navbar from '@/components/sections/Navbar';
import Footer from '@/components/sections/Footer';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      ...(isLogin ? {} : { 
        name: formData.get('name') as string, 
        tenant: formData.get('tenant') as string 
      }),
    };
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(result.error || "Authentication failed");
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar user={null} handleLogout={() => {}} />
      
      {/* Hero Section - Full Width */}
      <Hero />
      
      {/* Auth Modal - Positioned over hero */}
      <div className="fixed top-24 right-8 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              size="lg"
              className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 shadow-lg"
            >
              Get Started
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-brand-purple">
                {isLogin
                  ? "Login to your account"
                  : "Sign up for Universal Request Analyzer"}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleAuth}>
              {!isLogin && (
                <>
                  <input
                    name="name"
                    type="text"
                    placeholder="Full Name"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                  />
                  <input
                    name="tenant"
                    type="text"
                    placeholder="Team/Org Name (or 'personal')"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                  />
                </>
              )}
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              />
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-purple to-brand-blue text-white py-3 text-lg font-semibold"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isLogin
                  ? "Login"
                  : "Sign Up"}
              </Button>
            </form>
            <div className="text-center mt-4">
              <button
                className="text-sm text-brand-purple hover:underline"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Login"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content Sections */}
      <div>
        <Features />
        <Pricing />
        <Testimonials />
        <CallToAction />
      </div>
      
      <Footer />
    </div>
  );
}
