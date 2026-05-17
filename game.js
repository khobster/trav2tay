const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Logical (base) coordinate system. The game is designed for this height; the
// width adjusts dynamically so the play-area aspect matches the actual display.
const BASE_HEIGHT = 600;
let GAME_WIDTH = 400;
let GAME_HEIGHT = BASE_HEIGHT;

// Physics — these all operate in logical coordinates, so the feel is the
// same on every device.
const gravity = 1.8;
const flapPower = 7;
const flapDecay = 0.95;

// Game state
let birdX = 50;
let birdY = 100;
let flapVelocity = 0;
let score = 0;
const pipeGap = 280;
const pipeSpeed = 3.2;
let pipes = [];
let framesSinceLastPipe = 0;
const pipeInterval = 100;
let gameRunning = false;
let finalPipeAppeared = false;

// Bird sprite dims (logical pixels)
const BIRD_W = 92;
const BIRD_H = 64;

// Images
const spriteSheet = new Image();
const pipeImg = new Image();
const finalPipeImg = new Image();

let imagesLoaded = 0;
const totalImages = 3;
const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        resizeCanvas();
        document.getElementById('welcomeScreen').style.display = 'block';
    }
};
spriteSheet.onload = onImageLoad;
pipeImg.onload = onImageLoad;
finalPipeImg.onload = onImageLoad;
spriteSheet.src = 'travisbird.png';
pipeImg.src = 'pylon.png';
finalPipeImg.src = 'lastpipe4.png';

const spriteFrames = [
    { x: 0, y: 0 },
    { x: 92, y: 0 },
    { x: 184, y: 0 }
];
let currentFrameIndex = 0;
let frameCount = 0;

function resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isLandscape = vw > vh;

    let cssWidth, cssHeight;

    if (isLandscape) {
        // Desktop / landscape — lock to a phone-like portrait aspect and
        // center on a black background so there's no clipping or stretching.
        const targetAspect = 9 / 16; // width : height
        cssHeight = vh;
        cssWidth = cssHeight * targetAspect;
        if (cssWidth > vw) {
            cssWidth = vw;
            cssHeight = cssWidth / targetAspect;
        }
    } else {
        // Mobile / portrait — fill the entire viewport edge-to-edge.
        cssWidth = vw;
        cssHeight = vh;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    // Logical play area: keep BASE_HEIGHT constant; derive width to match
    // display aspect so sprites never get stretched.
    GAME_HEIGHT = BASE_HEIGHT;
    GAME_WIDTH = BASE_HEIGHT * (cssWidth / cssHeight);

    // Map logical units -> physical pixels.
    const scale = canvas.height / GAME_HEIGHT;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Anchor the bird at ~15% of the play-area width so it sits in a
    // comparable spot regardless of aspect ratio.
    birdX = Math.round(GAME_WIDTH * 0.15);

    positionWelcomeScreen(cssWidth, cssHeight);
}

function positionWelcomeScreen(cssWidth, cssHeight) {
    const w = document.getElementById('welcomeScreen');
    if (!w) return;
    const width = cssWidth || parseFloat(canvas.style.width) || window.innerWidth;
    const height = cssHeight || parseFloat(canvas.style.height) || window.innerHeight;
    w.style.width = width + 'px';
    w.style.height = height + 'px';
}

function flap() {
    if (gameRunning) flapVelocity = flapPower;
}

const welcomeEl = document.getElementById('welcomeScreen');
welcomeEl.addEventListener('click', startGame);
welcomeEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    flap();
}, { passive: false });
canvas.addEventListener('mousedown', flap, false);

document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        flap();
    }
}, false);

function startGame() {
    welcomeEl.style.display = 'none';
    resetState();
    gameRunning = true;
    gameLoop();
}

function resetState() {
    score = 0;
    pipes = [];
    framesSinceLastPipe = 0;
    finalPipeAppeared = false;
    flapVelocity = 0;
    birdY = 100;
    currentFrameIndex = 0;
    frameCount = 0;
}

function returnToStartScreen() {
    gameRunning = false;
    resetState();
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const modal = document.getElementById('gameOverModal');
    if (modal) modal.classList.remove('show');
    welcomeEl.style.display = 'block';
}

function updateBirdPosition() {
    birdY -= flapVelocity;
    flapVelocity *= flapDecay;
    birdY += gravity;

    if (birdY < 0) birdY = 0;
    if (birdY + BIRD_H >= GAME_HEIGHT) gameOver();
}

function drawBird() {
    const frameX = spriteFrames[currentFrameIndex].x;
    ctx.drawImage(spriteSheet, frameX, 0, BIRD_W, BIRD_H, birdX, birdY, BIRD_W, BIRD_H);
}

function updateFrame() {
    frameCount++;
    if (frameCount > 10) {
        frameCount = 0;
        currentFrameIndex = (currentFrameIndex + 1) % spriteFrames.length;
    }
}

function Pipe(x, isFinal = false) {
    this.x = x;
    this.top = isFinal ? 0 : Math.random() * (GAME_HEIGHT / 2);
    this.bottom = isFinal ? GAME_HEIGHT : GAME_HEIGHT - this.top - pipeGap;
    this.width = isFinal ? finalPipeImg.width * 0.8 : pipeImg.width;
    this.isFinal = isFinal;
}

function drawPipes() {
    pipes.forEach((pipe) => {
        if (pipe.isFinal) {
            ctx.drawImage(finalPipeImg, pipe.x, 0, finalPipeImg.width, GAME_HEIGHT);
        } else {
            ctx.drawImage(pipeImg, pipe.x, 0, pipe.width, pipe.top);
            ctx.drawImage(pipeImg, pipe.x, GAME_HEIGHT - pipe.bottom, pipe.width, pipe.bottom);
        }
    });
}

function updatePipes() {
    if (score < 100) {
        framesSinceLastPipe++;
        if (framesSinceLastPipe >= pipeInterval) {
            pipes.push(new Pipe(GAME_WIDTH));
            framesSinceLastPipe = 0;
        }
    } else if (!finalPipeAppeared) {
        finalPipeAppeared = true;
        setTimeout(() => {
            pipes.push(new Pipe(GAME_WIDTH, true));
        }, 3000);
    }

    pipes.forEach((pipe, index) => {
        pipe.x -= pipeSpeed;
        if (pipe.x + pipe.width < 0) {
            pipes.splice(index, 1);
            if (!finalPipeAppeared && index === 0) score++;
        }
    });
}

function checkCollisions() {
    for (let i = 0; i < pipes.length; i++) {
        const pipe = pipes[i];
        const hit = birdX < pipe.x + pipe.width && birdX + BIRD_W > pipe.x &&
                    (birdY < pipe.top || birdY + BIRD_H > GAME_HEIGHT - pipe.bottom);
        if (hit) {
            if (pipe.isFinal) {
                gameRunning = false;
                showEndGameModal('You win!', 'Play Again', 'Say 👋!');
                return;
            }
            gameOver();
            return;
        }
    }
}

function gameOver() {
    gameRunning = false;
    showEndGameModal('Game Over! Your score is: ' + score, 'Play Again', 'Say 👋!');
}

function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    updateBirdPosition();
    updateFrame();
    drawBird();
    updatePipes();
    drawPipes();
    checkCollisions();

    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'black';
    ctx.strokeText('Score: ' + score, 12, GAME_HEIGHT - 20);
    ctx.fillStyle = 'white';
    ctx.fillText('Score: ' + score, 12, GAME_HEIGHT - 20);

    requestAnimationFrame(gameLoop);
}

function showEndGameModal(message, primaryButtonText, secondaryButtonText) {
    const modal = document.getElementById('gameOverModal');
    const gameOverText = document.getElementById('gameOverText');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const contactBtn = document.getElementById('contactBtn');
    const closeButton = modal.querySelector('.close');

    gameOverText.innerText = message;
    playAgainBtn.innerText = primaryButtonText;
    contactBtn.innerText = secondaryButtonText;
    modal.classList.add('show');

    playAgainBtn.onclick = returnToStartScreen;
    closeButton.onclick = returnToStartScreen;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));

const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light', isLight);
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
}
applyTheme(localStorage.getItem('theme') || 'dark');
themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = document.body.classList.contains('light') ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
});
// Don't let taps on the toggle bubble to the canvas/welcome screen and trigger flap/start.
['mousedown', 'touchstart'].forEach((evt) => {
    themeToggle.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
});

resizeCanvas();
