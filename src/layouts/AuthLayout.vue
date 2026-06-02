<template>
  <div class="auth-layout">
    <div class="blob blob-violet" />
    <div class="blob blob-cyan" />
    <div class="blob blob-rose" />

    <div class="auth-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 2rem;
}

/* Floating background blobs */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  opacity: 0.38;
  animation: drift 12s ease-in-out infinite;
  pointer-events: none;
}

.blob-violet {
  width: 560px;
  height: 560px;
  background: radial-gradient(circle, #c4b5fd 0%, #8b5cf6 100%);
  top: -180px;
  left: -180px;
  animation-delay: 0s;
}

.blob-cyan {
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, #93c5fd 0%, #67e8f9 100%);
  bottom: -130px;
  right: -130px;
  animation-delay: -4.5s;
}

.blob-rose {
  width: 340px;
  height: 340px;
  background: radial-gradient(circle, #f9a8d4 0%, #fda4af 100%);
  top: 42%;
  left: 58%;
  animation-delay: -8s;
}

@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(28px, -28px) scale(1.06); }
  66%       { transform: translate(-20px, 20px) scale(0.94); }
}

.auth-content {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
