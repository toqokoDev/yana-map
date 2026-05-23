export function initScrollAnimations(selectors) {
  const observerOptions = { threshold: 0.15 };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  selectors.forEach((selector) => {
    const element = document.querySelector(selector);

    if (element) {
      observer.observe(element);
    }
  });
}
