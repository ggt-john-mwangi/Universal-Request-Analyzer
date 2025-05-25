
import React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

const CallToAction = () => {
  const variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
       <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-purple via-brand-deep-purple to-brand-blue opacity-80"></div>
       <img  
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 opacity-10 text-brand-accent transform rotate-45" 
        alt="Abstract background element 1" src="https://images.unsplash.com/photo-1689028294160-e78a88abcb19" />
      <img  
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 opacity-10 text-brand-light-purple transform -rotate-45" 
        alt="Abstract background element 2" src="https://images.unsplash.com/photo-1639327380081-bf86fc57a7a5" />
      <motion.div 
        className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={variants}
      >
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6">
          Ready to Supercharge Your Debugging?
        </h2>
        <p className="text-xl md:text-2xl text-foreground/80 max-w-2xl mx-auto mb-10">
          Stop guessing and start analyzing. Get Universal Request Analyzer today and gain unparalleled insight into your web application's network performance.
        </p>
        <Button 
          size="lg" 
          className="bg-brand-accent text-brand-deep-purple font-bold text-xl px-10 py-6 hover:bg-opacity-90 transition-opacity shadow-2xl transform hover:scale-105"
        >
          <DownloadCloud className="mr-3 h-7 w-7" />
          Download Now (It's Free!)
        </Button>
        <p className="mt-6 text-sm text-foreground/60">
          Compatible with Chrome, Firefox, and Edge.
        </p>
      </motion.div>
    </section>
  );
};

export default CallToAction;
  