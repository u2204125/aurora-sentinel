// Sparkling stars for Saturn loader
function createStar() {
    const starsContainer = document.querySelector('.saturn-stars');
    if (!starsContainer) return;
    const star = document.createElement('div');
    star.className = 'saturn-star';
    // Random position around Saturn (avoiding the center)
    const size = starsContainer.offsetWidth || 160;
    const centerSize = 80; // Area to avoid (slightly larger than Saturn)
    const centerOffset = (size - centerSize) / 2;
    
    let x, y;
    do {
        x = Math.random() * (size - 14);
        y = Math.random() * (size - 14);
    } while (
        x > centerOffset && 
        x < (centerOffset + centerSize) && 
        y > centerOffset && 
        y < (centerOffset + centerSize)
    );
    
    star.style.left = `${x}px`;
    star.style.top = `${y}px`;
    starsContainer.appendChild(star);
    setTimeout(() => {
        star.remove();
    }, 700);
}

function sparkleLoop() {
    if (!document.getElementById('loader')) return;
    createStar();
    setTimeout(sparkleLoop, 120 + Math.random() * 180);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(sparkleLoop, 100); // Ensure DOM is ready
    
    // Hide loader after DOM is loaded (for now, as requested)
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 1000);
        }
    }, 2000); // Show loader for 2 seconds before hiding
});
