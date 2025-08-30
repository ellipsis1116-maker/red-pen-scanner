let currentStream = null;

const videoEl = document.getElementById('video');

async function initCamera({ facingMode='environment', width=1280, height=720 } = {}) {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }
  const constraints = {
    audio: false,
    video: { width: { ideal: width }, height: { ideal: height }, facingMode }
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;
  videoEl.srcObject = stream;
  await videoEl.play().catch(()=>{});
  return stream;
}

export { initCamera };
