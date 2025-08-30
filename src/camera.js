let currentStream = null;
let currentTrack = null;
let currentDeviceId = null;

const videoEl = document.getElementById('video');

async function initCamera({ facingMode='environment', width=1280, height=720 } = {}) {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }
  const constraints = {
    audio: false,
    video: {
      width: { ideal: width },
      height: { ideal: height },
      facingMode,
    }
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;
  currentTrack = stream.getVideoTracks()[0];
  const settings = currentTrack.getSettings();
  currentDeviceId = settings.deviceId || null;

  videoEl.srcObject = stream;
  await videoEl.play().catch(()=>{});
  return stream;
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

async function switchCamera() {
  const cams = await listCameras();
  if (!cams.length) throw new Error('无可用相机');
  let idx = cams.findIndex(c => c.deviceId === currentDeviceId);
  idx = (idx + 1) % cams.length;
  return await initCamera({ facingMode: undefined, width: 1280, height: 720, deviceId: cams[idx].deviceId });
}

async function tryTorch(enabled) {
  if (!currentTrack) return false;
  const caps = currentTrack.getCapabilities?.();
  if (!caps || !('torch' in caps)) return false;
  try {
    await currentTrack.applyConstraints({ advanced: [{ torch: !!enabled }] });
    return true;
  } catch {
    return false;
  }
}

function getVideoEl() { return videoEl; }
function getCurrentStream() { return currentStream; }

export { initCamera, listCameras, switchCamera, tryTorch, getVideoEl, getCurrentStream };