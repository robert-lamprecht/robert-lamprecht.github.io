// Typewriter effect
const quote = "Knock, Knock, Neo.";
let charIndex = 0;
let isAddingNewDrops = true;
let animationInterval;

function typeWriter() {
    const quoteText = document.getElementById('quote-text');
    
    if (charIndex < quote.length) {
        quoteText.textContent += quote.charAt(charIndex);
        charIndex++;
        // Vary typing speed slightly for realism
        setTimeout(typeWriter, Math.random() * 50 + 50);
    } else {
        // Start matrix transition after quote is complete
        setTimeout(() => {
            startMatrixTransition();
        }, 2000);
    }
}

function startMatrixTransition() {
    const overlay = document.getElementById('intro-overlay');
    const matrixBg = document.getElementById('matrix-bg');
    
    overlay.style.opacity = '0';
    matrixBg.style.opacity = '1';
    
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 2000);
    
    // Start matrix animation
    animationInterval = setInterval(draw, 35);
    
    // Stop adding new drops after 5 seconds
    setTimeout(() => {
        isAddingNewDrops = false;
    }, 13000);
}

// Matrix rain effect
const canvas = document.getElementById('matrix-bg');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const matrix = "アБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ01234567890123456789";
const drops = [];
const fontSize = 16;
const columns = canvas.width/fontSize;

for(let x = 0; x < columns; x++) {
    drops[x] = 1;
}

function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00FF41';
    ctx.font = fontSize + 'px monospace';

    for(let i = 0; i < drops.length; i++) {
        const text = matrix[Math.floor(Math.random() * matrix.length)];
        ctx.fillText(text, i*fontSize, drops[i]*fontSize);

        if(drops[i]*fontSize > canvas.height) {
            if(isAddingNewDrops && Math.random() > 0.975) {
                drops[i] = 0;
            } else if(!isAddingNewDrops) {
                drops[i] = canvas.height/fontSize + 1;
            }
        }
        drops[i]++;
        
        const allDropsOffScreen = drops.every(drop => drop*fontSize > canvas.height);
        if(allDropsOffScreen && !isAddingNewDrops) {
            clearInterval(animationInterval);
        }
    }
}

// Event Listeners
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Start typing after a brief delay
setTimeout(typeWriter, 1000);