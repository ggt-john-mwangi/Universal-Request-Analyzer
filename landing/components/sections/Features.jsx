
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartBig, Settings, Eye, Zap, Download, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const featuresData = [
  {
    icon: <Eye className="h-10 w-10 text-brand-accent" />,
    title: 'Real-Time Capture',
    description: 'Capture and analyze network requests as they happen, with no delays.',
  },
  {
    icon: <BarChartBig className="h-10 w-10 text-brand-purple" />,
    title: 'Detailed Performance Metrics',
    description: 'Track DNS lookup, TCP connection, TTFB, download time, and more.',
  },
  {
    icon: <Zap className="h-10 w-10 text-brand-blue" />,
    title: 'Cross-Browser Compatibility',
    description: 'Works seamlessly on Chrome, Firefox, and Edge for consistent analysis.',
  },
  {
    icon: <Settings className="h-10 w-10 text-brand-light-purple" />,
    title: 'Configurable Monitoring',
    description: 'Enable/disable metrics, adjust sampling, and set retention periods.',
  },
  {
    icon: <Download className="h-10 w-10 text-brand-accent" />,
    title: 'Export Capabilities',
    description: 'Easily export request data and performance metrics for external use.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-brand-purple" />,
    title: 'Rich Visualization',
    description: 'Understand complex data quickly with intuitive charts and graphs.',
  },
];

const Features = () => {
  const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const featureItemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <section className="py-20 md:py-28 bg-brand-deep-purple/50">
      <motion.div 
        className="container mx-auto px-4 sm:px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
      >
        <div className="text-center mb-16">
          <motion.span 
            className="text-sm font-semibold text-brand-accent uppercase tracking-wider"
            variants={featureItemVariants}
          >
            Core Capabilities
          </motion.span>
          <motion.h2 
            className="text-4xl md:text-5xl font-extrabold text-white mt-2 mb-4"
            variants={featureItemVariants}
          >
            Why Choose Universal Request Analyzer?
          </motion.h2>
          <motion.p 
            className="text-lg text-foreground/70 max-w-2xl mx-auto"
            variants={featureItemVariants}
          >
            Unlock unparalleled insights into your web application's network activity and performance with our comprehensive suite of tools.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuresData.map((feature, index) => (
            <motion.div key={index} variants={featureItemVariants}>
              <Card className="h-full glassmorphic-card hover:border-brand-accent transition-all duration-300 transform hover:scale-105">
                <CardHeader className="items-center text-center">
                  <div className="p-4 bg-brand-purple/20 rounded-full mb-4 inline-block">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-2xl text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-foreground/80">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Features;
  