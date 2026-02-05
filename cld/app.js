// ========================================
// KAWAII PHOTO BOOTH - APPLICATION LOGIC
// ========================================

// Application State
const state = {
    selectedFrame: null,
    selectedLayout: 4,
    backgroundColor: '#ffb3d9',
    customFrameImage: null,
    capturedPhotos: [],
    cameraStream: null,
    facingMode: 'user',
    segmenter: null,
    currentScreen: 'landing'
};

// DOM Elements Cache
const elements = {
    // Screens
    screenLanding: document.getElementById('screen-landing'),
    screenBackground: document.getElementById('screen-background'),
    screenCamera: document.getElementById('screen-camera'),
    screenPreview: document.getElementById('screen-preview'),
    
    // Loading
    loadingScreen: document.getElementById('loading-screen'),
    
    // Frame Selection
    frameCards: document.querySelectorAll('.frame-card'),
    customFrameUpload: document.getElementById('custom-frame-upload'),
    layoutButtons: document.querySelectorAll('.layout-btn'),
    
    // Background Selection
    colorButtons: document.querySelectorAll('.color-btn'),
    customColorInput: document.getElementById('custom-color-input'),
    bgPreview: document.getElementById('bg-preview'),
    
    // Camera
    cameraVideo: document.getElementById('camera-video'),
    cameraCanvas: document.getElementById('camera-canvas'),
    countdownOverlay: document.getElementById('countdown-overlay'),
    flashOverlay: document.getElementById('flash-overlay'),
    photoCounter: document.getElementById('photo-counter'),
    currentPhotoNum: document.getElementById('current-photo-num'),
    totalPhotos: document.getElementById('total-photos'),
    
    // Buttons
    btnNextBg: document.getElementById('btn-next-bg'),
    btnBackFrame: document.getElementById('btn-back-frame'),
    btnStartCamera: document.getElementById('btn-start-camera'),
    btnBackBg: document.getElementById('btn-back-bg'),
    btnFlipCamera: document.getElementById('btn-flip-camera'),
    btnStartSession: document.getElementById('btn-start-session'),
    btnDownload: document.getElementById('btn-download'),
    btnShare: document.getElementById('btn-share'),
    btnRetake: document.getElementById('btn-retake'),
    
    // Preview
    finalCanvas: document.getElementById('final-canvas')
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Simulate loading
    setTimeout(() => {
        elements.loadingScreen.classList.add('hidden');
    }, 1500);
    
    // Setup event listeners
    setupEventListeners();
    
    // Load TensorFlow models (lazy load when camera starts)
    console.log('Kawaii Photo Booth initialized! ✨');
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Frame selection
    elements.frameCards.forEach(card => {
        card.addEventListener('click', () => selectFrame(card));
    });
    
    // Custom frame upload
    elements.customFrameUpload.addEventListener('change', handleCustomFrameUpload);
    
    // Layout selection
    elements.layoutButtons.forEach(btn => {
        btn.addEventListener('click', () => selectLayout(btn));
    });
    
    // Navigation buttons
    elements.btnNextBg.addEventListener('click', () => navigateToScreen('background'));
    elements.btnBackFrame.addEventListener('click', () => navigateToScreen('landing'));
    elements.btnStartCamera.addEventListener('click', startCamera);
    elements.btnBackBg.addEventListener('click', () => {
        stopCamera();
        navigateToScreen('background');
    });
    
    // Background color selection
    elements.colorButtons.forEach(btn => {
        btn.addEventListener('click', () => selectColor(btn));
    });
    
    elements.customColorInput.addEventListener('input', (e) => {
        state.backgroundColor = e.target.value;
        updateBackgroundPreview();
    });
    
    // Camera controls
    elements.btnFlipCamera.addEventListener('click', flipCamera);
    elements.btnStartSession.addEventListener('click', startPhotoSession);
    
    // Preview actions
    elements.btnDownload.addEventListener('click', downloadPhoto);
    elements.btnShare.addEventListener('click', sharePhoto);
    elements.btnRetake.addEventListener('click', retakePhotos);
}

// ========================================
// FRAME SELECTION
// ========================================

function selectFrame(card) {
    // Remove previous selection
    elements.frameCards.forEach(c => c.classList.remove('selected'));
    
    // Add selection
    card.classList.add('selected');
    state.selectedFrame = card.dataset.frame;
    
    // Enable next button
    elements.btnNextBg.disabled = false;
}

function handleCustomFrameUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.includes('png')) {
        alert('Please upload a PNG file with transparent background! 🥺');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large! Please keep it under 5MB 💕');
        return;
    }
    
    // Load custom frame
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.customFrameImage = img;
            state.selectedFrame = 'custom';
            
            // Clear other selections
            elements.frameCards.forEach(c => c.classList.remove('selected'));
            
            // Enable next button
            elements.btnNextBg.disabled = false;
            
            alert('Custom frame loaded! ✨');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// ========================================
// LAYOUT SELECTION
// ========================================

function selectLayout(btn) {
    elements.layoutButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedLayout = parseInt(btn.dataset.layout);
    
    // Update total photos display
    elements.totalPhotos.textContent = state.selectedLayout;
}

// ========================================
// BACKGROUND SELECTION
// ========================================

function selectColor(btn) {
    elements.colorButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.backgroundColor = btn.dataset.color;
    updateBackgroundPreview();
}

function updateBackgroundPreview() {
    elements.bgPreview.style.backgroundColor = state.backgroundColor;
}

// ========================================
// CAMERA MANAGEMENT
// ========================================

async function startCamera() {
    try {
        // Request camera permissions
        const constraints = {
            video: {
                facingMode: state.facingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.cameraVideo.srcObject = state.cameraStream;
        
        // Load background segmentation model
        await loadSegmentationModel();
        
        // Navigate to camera screen
        navigateToScreen('camera');
        
    } catch (error) {
        console.error('Camera error:', error);
        alert('Oops! Cannot access camera. Please check your permissions? 🥺');
    }
}

function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
}

async function flipCamera() {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    await startCamera();
}

async function loadSegmentationModel() {
    try {
        // Load BodyPix for background segmentation
        // Note: This is a simplified version. Full implementation would use TensorFlow.js
        console.log('Loading segmentation model...');
        // In production, you'd load: state.segmenter = await bodySegmentation.createSegmenter(...)
        console.log('Segmentation model ready! (Simulated)');
    } catch (error) {
        console.error('Model loading error:', error);
    }
}

// ========================================
// PHOTO CAPTURE
// ========================================

async function startPhotoSession() {
    state.capturedPhotos = [];
    elements.photoCounter.style.display = 'block';
    elements.btnStartSession.disabled = true;
    
    // Initial countdown (5 seconds)
    await countdown(5);
    
    // Capture photos
    for (let i = 0; i < state.selectedLayout; i++) {
        elements.currentPhotoNum.textContent = i + 1;
        
        // Capture photo
        await capturePhoto();
        
        // Wait before next photo (except last one)
        if (i < state.selectedLayout - 1) {
            await countdown(3);
        }
    }
    
    // Process and show preview
    await generateFinalComposite();
    navigateToScreen('preview');
    
    // Reset
    elements.photoCounter.style.display = 'none';
    elements.btnStartSession.disabled = false;
    stopCamera();
}

async function countdown(seconds) {
    const countdownNum = elements.countdownOverlay.querySelector('.countdown-number');
    elements.countdownOverlay.style.display = 'flex';
    
    for (let i = seconds; i > 0; i--) {
        countdownNum.textContent = i;
        countdownNum.style.animation = 'none';
        
        // Trigger reflow
        void countdownNum.offsetWidth;
        countdownNum.style.animation = 'countdownPulse 1s ease-out';
        
        // Play beep sound (optional)
        playBeep();
        
        await sleep(1000);
    }
    
    elements.countdownOverlay.style.display = 'none';
}

async function capturePhoto() {
    const video = elements.cameraVideo;
    const canvas = elements.cameraCanvas;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame
    ctx.save();
    ctx.scale(-1, 1); // Flip for mirror effect
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Flash effect
    elements.flashOverlay.classList.add('flash');
    setTimeout(() => elements.flashOverlay.classList.remove('flash'), 300);
    
    // Apply background removal (simplified - in production use actual segmentation)
    const imageData = await removeBackground(canvas);
    
    // Store captured photo
    state.capturedPhotos.push(imageData);
}

async function removeBackground(canvas) {
    const ctx = canvas.getContext('2d');
    
    // In a real implementation, you would:
    // 1. Use bodySegmentation.segmentPeople() to get person mask
    // 2. Apply mask to remove background
    // 3. Fill background with selected color
    
    // For MVP, we'll just return the canvas data
    // with background color composite
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Fill background color
    tempCtx.fillStyle = state.backgroundColor;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw original image on top
    tempCtx.drawImage(canvas, 0, 0);
    
    return tempCanvas.toDataURL('image/png');
}

// ========================================
// FINAL COMPOSITE GENERATION
// ========================================

async function generateFinalComposite() {
    const canvas = elements.finalCanvas;
    const ctx = canvas.getContext('2d');
    
    // Calculate dimensions based on layout
    const photoWidth = 400;
    const photoHeight = 300;
    const padding = 20;
    const frameWidth = photoWidth + (padding * 2);
    
    let rows, cols;
    switch(state.selectedLayout) {
        case 2:
            rows = 2; cols = 1;
            break;
        case 4:
            rows = 4; cols = 1;
            break;
        case 6:
            rows = 3; cols = 2;
            break;
        default:
            rows = 4; cols = 1;
    }
    
    const frameHeight = (photoHeight + padding) * rows + padding;
    
    // Set canvas size
    canvas.width = frameWidth * cols;
    canvas.height = frameHeight;
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw photos
    for (let i = 0; i < state.capturedPhotos.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const x = col * frameWidth + padding;
        const y = row * (photoHeight + padding) + padding;
        
        const img = new Image();
        img.src = state.capturedPhotos[i];
        
        await new Promise((resolve) => {
            img.onload = () => {
                ctx.drawImage(img, x, y, photoWidth, photoHeight);
                resolve();
            };
        });
    }
    
    // Apply frame overlay (simplified)
    await applyFrameOverlay(ctx, canvas);
}

async function applyFrameOverlay(ctx, canvas) {
    // In production, you would draw the actual frame SVG/image
    // For MVP, we'll add a simple decorative border
    
    ctx.strokeStyle = '#ff99c8';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Add decorative corners
    const cornerSize = 30;
    ctx.fillStyle = '#ff99c8';
    
    // Top-left
    ctx.fillText('💕', 20, 40);
    // Top-right
    ctx.fillText('✨', canvas.width - 40, 40);
    // Bottom-left
    ctx.fillText('🌸', 20, canvas.height - 20);
    // Bottom-right
    ctx.fillText('💖', canvas.width - 40, canvas.height - 20);
}

// ========================================
// DOWNLOAD & SHARE
// ========================================

function downloadPhoto() {
    const canvas = elements.finalCanvas;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `KawaiiBooth_${timestamp}.png`;
    
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

async function sharePhoto() {
    const canvas = elements.finalCanvas;
    
    try {
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'kawaii-booth.png', { type: 'image/png' });
            
            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: 'Kawaii Photo Booth',
                    text: 'Created with Kawaii Photo Booth 💕✨ #KawaiiBoothMoments'
                });
            } else {
                // Fallback: copy to clipboard
                alert('Sharing is not supported on this device. Use the download button instead! 💕');
            }
        }, 'image/png');
    } catch (error) {
        console.error('Share error:', error);
        alert('Oops! Could not share. Try downloading instead! 🥺');
    }
}

function retakePhotos() {
    if (confirm('Are you sure you want to retake all photos? 🤔')) {
        state.capturedPhotos = [];
        navigateToScreen('landing');
    }
}

// ========================================
// NAVIGATION
// ========================================

function navigateToScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    switch(screenName) {
        case 'landing':
            elements.screenLanding.classList.add('active');
            state.currentScreen = 'landing';
            break;
        case 'background':
            elements.screenBackground.classList.add('active');
            updateBackgroundPreview();
            state.currentScreen = 'background';
            break;
        case 'camera':
            elements.screenCamera.classList.add('active');
            state.currentScreen = 'camera';
            break;
        case 'preview':
            elements.screenPreview.classList.add('active');
            state.currentScreen = 'preview';
            break;
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function playBeep() {
    // Simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Silent fail - sound is optional
        console.log('Audio not available');
    }
}

// ========================================
// ERROR HANDLING
// ========================================

window.addEventListener('error', (e) => {
    console.error('Application error:', e);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e);
});

// ========================================
// EXPORT FOR DEBUGGING
// ========================================

if (typeof window !== 'undefined') {
    window.KawaiiBoothState = state;
    console.log('Debug: Access app state via window.KawaiiBoothState');
}
