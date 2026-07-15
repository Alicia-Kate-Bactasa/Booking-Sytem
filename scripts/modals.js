/**
 * File: scripts/modals.js
 * Purpose: Custom Modal System for Montage Auto Studio.
 *          Replaces native blocking window.alert and window.confirm with custom,
 *          animated, promise-based HTML dialogs matching the studio's premium dark aesthetic.
 * Public APIs exposed on window:
 *   - window.showErrorModal(message, isInfo): Shows alert dialog. Resolves promise when OK clicked.
 *   - window.showConfirmModal(message): Shows confirmation dialog. Resolves promise with true (Yes) or false (No).
 */

(function() {
    // Inject custom alert modal styles into document head
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes modalScaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-modal-fade-in {
            animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-modal-scale-in {
            animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
    `;
    document.head.appendChild(style);

    // Custom Alert Implementation
    function showCustomAlert(message) {
        return new Promise((resolve) => {
            // Remove existing modal if any
            const existing = document.getElementById('customAlertModal');
            if (existing) existing.remove();

            const alertModal = document.createElement('div');
            alertModal.id = 'customAlertModal';
            alertModal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950/70 backdrop-blur-md opacity-0 animate-modal-fade-in';
            alertModal.innerHTML = `
                <div class="bg-white p-8 w-full max-w-md relative rounded-[2.5rem] shadow-2xl mx-4 border border-neutral-200/80 animate-modal-scale-in">
                    <div class="text-center space-y-6">
                        <!-- Premium Studio Accent Icon -->
                        <div class="w-14 h-14 rounded-full bg-neutral-950 flex items-center justify-center mx-auto text-amber-400 shadow-lg border border-neutral-800">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.084 1.085l-.041.02H11.25v2.25h-.75v-2.25h-.75a.75.75 0 010-1.5h1.5v-.025zM12 22.5c5.799 0 10.5-4.701 10.5-10.5S17.799 1.5 12 1.5 1.5 6.201 1.5 12 6.201 22.5 12 22.5z" />
                            </svg>
                        </div>
                        <div>
                            <span class="text-[9px] tracking-[0.25em] font-black text-neutral-400 uppercase block mb-1">Montage Auto Studio</span>
                            <h3 class="text-lg font-black uppercase tracking-tight text-neutral-900">Notification</h3>
                            <p class="text-xs text-neutral-500 font-medium mt-3 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto px-1">
                                ${escapeHtml(message)}
                            </p>
                        </div>
                        <div class="pt-2">
                            <button id="customAlertOkBtn" type="button" class="w-full bg-neutral-950 text-white text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-neutral-950 hover:bg-neutral-850 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md focus:outline-none">
                                Acknowledge
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(alertModal);

            const okBtn = document.getElementById('customAlertOkBtn');
            const closeAlert = () => {
                alertModal.classList.add('transition-opacity', 'duration-200', 'opacity-0');
                setTimeout(() => {
                    alertModal.remove();
                    resolve();
                }, 200);
            };

            okBtn.addEventListener('click', closeAlert);
            
            // Allow close on Enter key
            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', handleKeydown);
                    closeAlert();
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    // Custom Confirm Implementation
    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            // Remove existing modal if any
            const existing = document.getElementById('customConfirmModal');
            if (existing) existing.remove();

            const confirmModal = document.createElement('div');
            confirmModal.id = 'customConfirmModal';
            confirmModal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950/70 backdrop-blur-md opacity-0 animate-modal-fade-in';
            confirmModal.innerHTML = `
                <div class="bg-white p-8 w-full max-w-md relative rounded-[2.5rem] shadow-2xl mx-4 border border-neutral-200/80 animate-modal-scale-in">
                    <div class="text-center space-y-6">
                        <!-- Premium Action Icon -->
                        <div class="w-14 h-14 rounded-full bg-neutral-950 flex items-center justify-center mx-auto text-amber-400 shadow-lg border border-neutral-800">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div>
                            <span class="text-[9px] tracking-[0.25em] font-black text-neutral-400 uppercase block mb-1">Montage Auto Studio</span>
                            <h3 class="text-lg font-black uppercase tracking-tight text-neutral-900">Confirmation Required</h3>
                            <p class="text-xs text-neutral-500 font-medium mt-3 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto px-1">
                                ${escapeHtml(message)}
                            </p>
                        </div>
                        <div class="flex gap-4 pt-2">
                            <button id="customConfirmCancelBtn" type="button" class="w-1/2 bg-white text-neutral-700 text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-neutral-200 hover:bg-neutral-50 hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none">
                                Cancel
                            </button>
                            <button id="customConfirmOkBtn" type="button" class="w-1/2 bg-neutral-950 text-white text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-neutral-950 hover:bg-neutral-850 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md focus:outline-none">
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);

            const cancelBtn = document.getElementById('customConfirmCancelBtn');
            const okBtn = document.getElementById('customConfirmOkBtn');

            const handleCancel = () => {
                closeConfirm(false);
            };

            const handleConfirm = () => {
                closeConfirm(true);
            };

            const closeConfirm = (result) => {
                confirmModal.classList.add('transition-opacity', 'duration-200', 'opacity-0');
                setTimeout(() => {
                    confirmModal.remove();
                    resolve(result);
                }, 200);
            };

            cancelBtn.addEventListener('click', handleCancel);
            okBtn.addEventListener('click', handleConfirm);

            // Allow Enter for Confirm, Escape for Cancel
            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', handleKeydown);
                    closeConfirm(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.removeEventListener('keydown', handleKeydown);
                    closeConfirm(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    // Helper to prevent HTML injection in message text
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Bind to window to override native dialog functions
    window.alert = showCustomAlert;
    window.confirm = showCustomConfirm;
})();
