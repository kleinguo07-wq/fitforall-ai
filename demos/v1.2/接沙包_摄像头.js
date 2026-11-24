"use strict";

(() => {
  const scriptUrl = document.currentScript.src;
  const mediapipeUrl = new URL("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs", scriptUrl);
  const wasmUrl = new URL("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm", scriptUrl);
  const modelUrl = new URL("接沙包_pose_landmarker_lite.task", scriptUrl);
  const frameIntervalMs = 60;
  const staleVideoMs = 360;

  function validPoint(point, confidence) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && (point.visibility ?? 1) >= confidence && (point.presence ?? 1) >= confidence;
  }

  function projectCoverPoints(video, arena) {
    const frame = video.getBoundingClientRect();
    const playArea = arena.getBoundingClientRect();
    if (!frame.width || !frame.height || !playArea.width || !playArea.height
      || !video.videoWidth || !video.videoHeight) return null;

    const scale = Math.max(frame.width / video.videoWidth, frame.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const left = frame.left - playArea.left + (frame.width - width) / 2;
    const top = frame.top - playArea.top + (frame.height - height) / 2;

    return point => ({
      x: (left + (1 - point.x) * width) / playArea.width,
      y: (top + point.y * height) / playArea.height,
    });
  }

  function measurePerson(landmarks, project) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const hips = [landmarks[23], landmarks[24]].filter(point => validPoint(point, 0.35)).map(project);
    if (!validPoint(leftShoulder, 0.35) || !validPoint(rightShoulder, 0.35) || !hips.length) return null;

    const left = project(leftShoulder);
    const right = project(rightShoulder);
    const shoulders = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const hipY = hips.reduce((sum, point) => sum + point.y, 0) / hips.length;
    const shoulderWidth = Math.abs(left.x - right.x);
    const torsoHeight = hipY - shoulders.y;
    if (shoulderWidth < 0.02 || torsoHeight < 0.03) return null;

    const hands = [landmarks[15], landmarks[16]].map(point => {
      if (!validPoint(point, 0.48)) return null;
      const position = project(point);
      return position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1 ? position : null;
    });
    const arms = [left, right].map((shoulder, index) => {
      const elbow = landmarks[13 + index];
      return { shoulder, elbow: validPoint(elbow, 0.45) ? project(elbow) : null, wrist: hands[index] };
    }).sort((a, b) => a.shoulder.x - b.shoulder.x);

    return {
      center: { x: shoulders.x, y: (shoulders.y + hipY) / 2 },
      shoulderWidth,
      torsoHeight,
      hipY,
      hips,
      arms,
      face: landmarks.slice(0, 11).filter(point => validPoint(point, 0.45)).map(project),
      hands,
    };
  }

  function stopStream(stream) {
    stream?.getTracks().forEach(track => track.stop());
  }

  function startupMessage(error, cameraReady) {
    if (!cameraReady) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return "摄像头权限未开启。可以在浏览器中允许访问，或用鼠标体验。";
      }
      if (error.name === "NotFoundError") return "未找到摄像头，可以用鼠标体验。";
      if (error.name === "NotReadableError") return "摄像头暂不可用，请检查其他应用是否正在使用。";
      return "摄像头启动失败，请重试或用鼠标体验。";
    }
    return "姿态模型加载失败。请从本地预览地址重新打开，或用鼠标体验。";
  }

  window.createSandbagCamera = function createSandbagCamera({ video, arena, onFrame, onError }) {
    let activeSession = null;

    function stop() {
      const session = activeSession;
      if (!session) return;
      activeSession = null;
      cancelAnimationFrame(session.animationFrame);
      stopStream(session.stream);
      session.detector?.close();
      video.pause();
      video.srcObject = null;
    }

    function reportStopped(session, message) {
      if (activeSession !== session) return;
      stop();
      onError(new Error(message));
    }

    function processFrame(session, now) {
      if (activeSession !== session) return;
      const hasNewFrame = video.readyState >= 2 && video.currentTime !== session.videoTime;

      try {
        if (hasNewFrame && now - session.lastFrameAt >= frameIntervalMs) {
          session.lastFrameAt = now;
          session.videoTime = video.currentTime;
          session.reportedStale = false;
          const project = projectCoverPoints(video, arena);
          const result = session.detector.detectForVideo(video, now);
          const people = project ? result.landmarks.map(pose => measurePerson(pose, project)).filter(Boolean) : [];
          onFrame({ people });
        } else if (!session.reportedStale && now - session.lastFrameAt > staleVideoMs) {
          session.reportedStale = true;
          onFrame({ people: [] });
        }
      } catch {
        reportStopped(session, "摄像头识别中断，请重新开启或用鼠标体验。");
        return;
      }

      if (activeSession === session) {
        session.animationFrame = requestAnimationFrame(next => processFrame(session, next));
      }
    }

    async function start() {
      stop();
      if (window.location.protocol === "file:") {
        throw new Error("摄像头模式请从本地预览地址（localhost）打开。此页面可直接用鼠标体验。");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("当前浏览器环境无法访问摄像头，请用 Chrome 打开 HTTPS 试玩页。");
      }

      const session = { stream: null, detector: null, animationFrame: 0, lastFrameAt: 0, videoTime: -1, reportedStale: false };
      activeSession = session;
      let cameraReady = false;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } },
        });
        if (activeSession !== session) {
          stopStream(stream);
          return false;
        }
        session.stream = stream;
        stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => {
          reportStopped(session, "摄像头已断开，可以重新开启或用鼠标体验。");
        }, { once: true }));
        video.srcObject = stream;
        await video.play();
        if (activeSession !== session) return false;
        cameraReady = true;

        const { FilesetResolver, PoseLandmarker } = await import(mediapipeUrl.href);
        if (activeSession !== session) return false;
        const fileset = await FilesetResolver.forVisionTasks(wasmUrl.href);
        if (activeSession !== session) return false;
        const detector = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl.href, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 2,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });
        if (activeSession !== session) {
          detector.close();
          return false;
        }

        session.detector = detector;
        session.lastFrameAt = performance.now();
        session.animationFrame = requestAnimationFrame(now => processFrame(session, now));
        return true;
      } catch (error) {
        if (activeSession !== session) return false;
        stop();
        throw new Error(startupMessage(error, cameraReady), { cause: error });
      }
    }

    return { start, stop };
  };
})();
