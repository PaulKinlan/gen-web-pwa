// PWA Install Prompt Handler
let deferredPrompt = null;

// Listen for the beforeinstallprompt event
window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install UI
  showInstallPromotion();
});

function showInstallPromotion() {
  const installSection = document.getElementById("install-section");
  if (installSection) {
    installSection.style.display = "block";
  }
}

function hideInstallPromotion() {
  const installSection = document.getElementById("install-section");
  if (installSection) {
    installSection.style.display = "none";
  }
}

// Handle install button click
window.installPWA = async function () {
  if (!deferredPrompt) {
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;

  console.log(`User response to the install prompt: ${outcome}`);

  // Clear the deferredPrompt for reuse
  deferredPrompt = null;
  hideInstallPromotion();
};
