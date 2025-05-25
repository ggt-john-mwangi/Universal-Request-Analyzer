
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonialsData = [
  {
    name: 'Sarah L.',
    title: 'Senior Frontend Developer',
    avatarText: 'SL',
    imagePlaceholder: 'Woman with glasses coding on a laptop',
    quote: "Universal Request Analyzer has become an indispensable tool in my workflow. The real-time insights and detailed metrics save me hours of debugging time. It's incredibly intuitive!",
    rating: 5,
  },
  {
    name: 'Mike R.',
    title: 'Tech Lead @ Innovate Solutions',
    avatarText: 'MR',
    imagePlaceholder: 'Man in a suit presenting a graph',
    quote: "Our team integrated URA, and the impact on identifying performance bottlenecks was immediate. The cross-browser support is a huge plus. Highly recommended!",
    rating: 5,
  },
  {
    name: 'Jessica P.',
    title: 'Full-Stack Engineer',
    avatarText: 'JP',
    imagePlaceholder: 'Person working on multiple monitors',
    quote: "I love the configurability. Being able to toggle specific metrics means I only see what I need. The UI is clean and modern, very much in the Notion/Linear style I appreciate.",
    rating: 4,
  },
];

const Testimonials = () => {
  const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const testimonialItemVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
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
            variants={testimonialItemVariants}
          >
            Trusted by Developers
          </motion.span>
          <motion.h2 
            className="text-4xl md:text-5xl font-extrabold text-white mt-2 mb-4"
            variants={testimonialItemVariants}
          >
            What Our Users Say
          </motion.h2>
          <motion.p 
            className="text-lg text-foreground/70 max-w-2xl mx-auto"
            variants={testimonialItemVariants}
          >
            Hear from developers and tech leads who are leveraging Universal Request Analyzer to enhance their productivity and application performance.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonialsData.map((testimonial, index) => (
            <motion.div key={index} variants={testimonialItemVariants}>
              <Card className="h-full flex flex-col glassmorphic-card hover:border-brand-accent transition-all duration-300 transform hover:shadow-2xl">
                <CardHeader>
                  <div className="flex items-center mb-4">
                    <Avatar className="h-12 w-12 mr-4 border-2 border-brand-accent">
                      <AvatarImage asChild>
                        <img  src={`https://i.pravatar.cc/48?u=${testimonial.name}`} alt={testimonial.name} src="https://images.unsplash.com/photo-1677696795873-ca21e7d76a51" />
                      </AvatarImage>
                      <AvatarFallback className="bg-brand-purple text-white font-semibold">{testimonial.avatarText}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg text-white">{testimonial.name}</p>
                      <p className="text-sm text-brand-light-purple">{testimonial.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`}
                      />
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-foreground/80 italic">"{testimonial.quote}"</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Testimonials;
  