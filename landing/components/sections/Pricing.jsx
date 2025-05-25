
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const pricingTiers = [
  {
    name: 'Basic',
    price: 'Free',
    period: '',
    description: 'For individuals starting out with network analysis.',
    features: [
      { text: 'Real-time request capture', included: true },
      { text: 'Basic performance metrics', included: true },
      { text: 'Cross-browser compatibility', included: true },
      { text: 'Limited data retention (7 days)', included: true },
      { text: 'Community support', included: true },
      { text: 'Advanced filters', included: false },
      { text: 'Data export', included: false },
    ],
    cta: 'Get Started for Free',
    popular: false,
    gradient: 'from-gray-700 to-gray-600'
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/ month',
    description: 'For professionals and teams needing advanced features.',
    features: [
      { text: 'All Basic features', included: true },
      { text: 'Full performance metrics suite', included: true },
      { text: 'Advanced filters & sorting', included: true },
      { text: 'Data export (CSV, JSON)', included: true },
      { text: 'Configurable data retention (up to 90 days)', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Rich visualizations', included: true },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    gradient: 'from-brand-purple to-brand-blue'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with specific needs.',
    features: [
      { text: 'All Pro features', included: true },
      { text: 'Custom metric configuration', included: true },
      { text: 'Team collaboration features', included: true },
      { text: 'SAML/SSO integration', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Custom data retention policies', included: true },
      { text: 'On-premise deployment option', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
    gradient: 'from-brand-blue to-brand-accent'
  },
];

const Pricing = () => {
  const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const pricingItemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 80, damping: 12 }
    }
  };

  return (
    <section className="py-20 md:py-28 bg-white">
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
            variants={pricingItemVariants}
          >
            Simple & Transparent
          </motion.span>
          <motion.h2 
            className="text-4xl md:text-5xl font-extrabold text-brand-deep-purple mt-2 mb-4"
            variants={pricingItemVariants}
          >
            Choose Your Plan
          </motion.h2>
          <motion.p 
            className="text-lg text-foreground/70 max-w-2xl mx-auto"
            variants={pricingItemVariants}
          >
            Flexible pricing options designed to fit your needs, whether you're an individual developer or a large enterprise.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {pricingTiers.map((tier) => (
            <motion.div 
              key={tier.name}
              variants={pricingItemVariants}
              className="flex"
            >
              <Card 
                className={`w-full flex flex-col glassmorphic-card border-2 transition-all duration-300 transform hover:scale-105 ${
                  tier.popular ? 'border-brand-accent shadow-2xl' : 'border-transparent'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-accent text-brand-deep-purple px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center pt-10">
                  <CardTitle className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${tier.gradient} mb-2`}>{tier.name}</CardTitle>
                  <span className="text-4xl font-extrabold text-brand-deep-purple">{tier.price}</span>
                  {tier.period && <span className="text-sm text-foreground/70">{tier.period}</span>}
                  <CardDescription className="mt-3 text-foreground/80 h-12">{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center">
                        {feature.included ? (
                          <CheckCircle className="h-5 w-5 text-green-400 mr-2 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 mr-2 shrink-0" />
                        )}
                        <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-foreground/60'}`}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button 
                    size="lg" 
                    className={`w-full font-semibold text-lg hover:opacity-90 transition-opacity shadow-md ${tier.popular ? 'bg-gradient-to-r text-white ' + tier.gradient : 'bg-brand-accent text-brand-deep-purple'}`}
                  >
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Pricing;
  