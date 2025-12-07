// Help Page Interactive Features
// Script runs after DOM is loaded (loaded at bottom of body)

console.log('Help page script starting...');

// Tab switching with smooth transitions
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

console.log('Found', tabButtons.length, 'tab buttons');
console.log('Found', tabContents.length, 'tab contents');

tabButtons.forEach((btn, index) => {
  console.log(`Tab button ${index}:`, btn.dataset.tab);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = btn.dataset.tab;
    console.log('Tab clicked:', tab);
    
    // Remove active from all buttons
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Hide all content
    tabContents.forEach(c => {
      c.classList.remove('active');
    });
    
    // Show selected content
    const targetContent = document.querySelector(`[data-content="${tab}"]`);
    if (targetContent) {
      targetContent.classList.add('active');
      console.log('Activated tab:', tab);
    } else {
      console.error('Tab content not found for:', tab);
    }
    
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// FAQ collapse/expand with enhanced interactions
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const answer = question.nextElementSibling;
    const icon = question.querySelector('i');
    const isExpanded = answer.style.display === 'block';
    
    if (isExpanded) {
      // Collapse
      answer.style.display = 'none';
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');
      question.classList.remove('expanded');
    } else {
      // Expand
      answer.style.display = 'block';
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');
      question.classList.add('expanded');
      
      // Smooth scroll to question
      setTimeout(() => {
        question.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  });
  
  // Initially hide all answers
  const answer = question.nextElementSibling;
  if (answer) {
    answer.style.display = 'none';
  }
});

// Add keyboard navigation for tabs
document.addEventListener('keydown', (e) => {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const activeTab = document.querySelector('.tab-btn.active');
  const currentIndex = tabs.indexOf(activeTab);
  
  if (e.key === 'ArrowLeft' && currentIndex > 0) {
    tabs[currentIndex - 1].click();
    e.preventDefault();
  } else if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
    tabs[currentIndex + 1].click();
    e.preventDefault();
  }
});

// Add smooth animations for feature cards
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '0';
      entry.target.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        entry.target.style.transition = 'all 0.5s ease';
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, 100);
      
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe feature cards for animation
document.querySelectorAll('.feature-card').forEach(card => {
  observer.observe(card);
});

console.log('Universal Request Analyzer - Help Page loaded successfully');
