
import React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-deep-purple via-brand-purple to-brand-blue overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 -z-10">
        <motion.div 
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-brand-accent/30 rounded-full blur-3xl animate-subtle-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-brand-light-purple/20 rounded-full blur-2xl animate-subtle-pulse animation-delay-500" />
          <div className="absolute top-1/3 right-1/2 w-20 h-20 bg-brand-accent/25 rounded-full blur-xl animate-subtle-pulse animation-delay-1000" />
        </motion.div>
      </div>

      {/* Main hero content */}
      <motion.div 
        className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-brand-light-purple to-brand-accent"
          variants={itemVariants}
        >
          Analyze Network Requests <span className="block md:inline">Like Never Before.</span>
        </motion.h1>
        <motion.p 
          className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto mb-10"
          variants={itemVariants}
        >
          Universal Request Analyzer is a powerful browser extension for analyzing and monitoring network requests with detailed performance metrics, in real-time.
        </motion.p>
        <motion.div 
          className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6"
          variants={itemVariants}
        >
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-brand-accent to-brand-blue text-brand-deep-purple font-semibold text-lg w-full sm:w-auto hover:opacity-90 transition-opacity shadow-lg transform hover:scale-105"
          >
            <DownloadCloud className="mr-2 h-5 w-5" />
            Download Extension
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="border-white/30 text-white hover:bg-white/10 hover:text-white font-semibold text-lg w-full sm:w-auto transition-colors shadow-lg transform hover:scale-105 backdrop-blur-sm"
          >
            <Zap className="mr-2 h-5 w-5" />
            See Features
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
  