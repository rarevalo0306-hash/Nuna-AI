// Voice controls stay beside the composer so the conversation remains visible.
// Audio is not connected yet; do not imply that a microphone is recording.
const oldVoiceDialog = document.getElementById('voice-dialog');
const voiceDialog = document.createElement('section');
voiceDialog.id = 'voice-dialog';
voiceDialog.className = 'voice-inline';
voiceDialog.hidden = true;
voiceDialog.setAttribute('aria-label', 'Controles de voz');
const voiceToolbar = document.createElement('div');
voiceToolbar.className = 'voice-toolbar';
const voiceLabel = document.createElement('strong');
voiceLabel.textContent = 'NUNA · Voz';
const voiceClose = document.createElement('button');
voiceClose.id = 'voice-close';
voiceClose.type = 'button';
voiceClose.className = 'icon';
voiceClose.textContent = '×';
voiceToolbar.append(voiceLabel, voiceClose);
const voiceStatus = document.createElement('p');
voiceStatus.id = 'voice-status';
voiceStatus.setAttribute('role', 'status');
const voiceNote = document.createElement('p');
voiceNote.id = 'voice-note';
voiceDialog.append(voiceToolbar, voiceStatus, voiceNote);
oldVoiceDialog.remove();
document.querySelector('.composer-area').prepend(voiceDialog);
const voiceStyle = document.createElement('style');
voiceStyle.textContent = `
#voice-dialog.voice-inline{position:static;inset:auto;margin:0 0 10px;width:100%;height:auto;min-height:0;max-width:none;max-height:none;box-sizing:border-box;border:1px solid var(--border);border-radius:16px;background:var(--card);color:var(--text);padding:12px 16px;box-shadow:none;color-scheme:normal;overflow:visible}
#voice-dialog.voice-inline[hidden]{display:none!important}
#voice-dialog.voice-inline .voice-toolbar{position:static;display:flex;align-items:center;justify-content:space-between;padding:0;border:0;font-size:13px;color:var(--text)}
#voice-dialog.voice-inline #voice-close{width:36px;height:36px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--side);color:var(--text);font-size:20px;flex-shrink:0}
#voice-dialog.voice-inline #voice-status{font-size:13px;min-height:0;margin:4px 0;color:var(--muted)}
#voice-dialog.voice-inline #voice-status:before{display:none}
#voice-dialog.voice-inline #voice-note{max-width:none;margin:4px 0 0;font-size:12px;line-height:1.4;color:var(--muted)}
#voice-open[aria-expanded=true]{background:var(--accent);color:var(--bg)}
@media(max-width:760px){#voice-dialog.voice-inline{padding:10px 12px}#voice-dialog.voice-inline #voice-close{width:44px;height:44px}}
`;
document.head.append(voiceStyle);
const voiceOpen = document.getElementById('voice-open');
voiceOpen.setAttribute('aria-controls', voiceDialog.id);
voiceOpen.setAttribute('aria-expanded', 'false');
function renderVoice() {
  const es = lang === 'es';
  voiceLabel.textContent = es ? 'NUNA · Voz' : 'NUNA · Voice';
  voiceDialog.setAttribute('aria-label', es ? 'Controles de voz' : 'Voice controls');
  voiceOpen.setAttribute('aria-label', voiceDialog.hidden ? (es ? 'Abrir controles de voz' : 'Open voice controls') : (es ? 'Cerrar controles de voz' : 'Close voice controls'));
  voiceClose.setAttribute('aria-label', es ? 'Cerrar controles de voz' : 'Close voice controls');
  voiceStatus.textContent = es ? 'Voz en preparación · micrófono apagado' : 'Voice coming soon · microphone off';
  voiceNote.textContent = es ? 'El audio real aún no está conectado. Puedes seguir usando el chat.' : 'Live audio is not connected yet. You can keep using the chat.';
}
function closeInlineVoice() {
  voiceDialog.hidden = true;
  voiceOpen.setAttribute('aria-expanded', 'false');
  renderVoice();
  voiceOpen.focus();
}
voiceOpen.onclick = () => {
  if (!voiceDialog.hidden) { closeInlineVoice(); return; }
  voiceDialog.hidden = false;
  voiceOpen.setAttribute('aria-expanded', 'true');
  renderVoice();
};
voiceClose.onclick = closeInlineVoice;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !voiceDialog.hidden && !document.querySelector('dialog[open]')) { e.preventDefault(); closeInlineVoice(); }
});
new MutationObserver(renderVoice).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
renderVoice();
