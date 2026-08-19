const mediaByCategory: Record<string, { src: string; alt: string }> = {
  Robotics: { src: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=85', alt: 'Small educational robot on a workbench' },
  Electronics: { src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85', alt: 'Electronic circuit board close-up' },
  Learning: { src: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1200&q=85', alt: 'Robotics team working on a prototype' },
  Components: { src: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=85', alt: 'Motors and electronics components' },
  'AI + IoT': { src: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85', alt: 'Team collaborating around connected technology' },
  '3D Printing': { src: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=85', alt: 'Engineer working on a fabrication prototype' },
  'Project Solutions': { src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=85', alt: 'Engineer working on a technology prototype' },
}

export function getProductMedia(category: string) {
  return mediaByCategory[category] || mediaByCategory.Robotics
}
