// Generic Drag & Drop Reordering Utility
function makeListDraggable(containerEl, handleSelector, onReorderCallback) {
  if (!containerEl) return;

  let draggedItem = null;

  const items = containerEl.querySelectorAll('li');
  items.forEach(item => {
    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id || '');
    });

    item.addEventListener('dragend', () => {
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
      }
      containerEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      draggedItem = null;

      // Extract new order of IDs
      const newOrder = Array.from(containerEl.children).map(child => child.dataset.id).filter(Boolean);
      if (onReorderCallback) {
        onReorderCallback(newOrder);
      }
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const target = e.target.closest('li');
      if (target && target !== draggedItem && target.parentNode === containerEl) {
        const rect = target.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        containerEl.insertBefore(draggedItem, next ? target.nextSibling : target);
      }
    });

    item.addEventListener('dragenter', (e) => {
      const target = e.target.closest('li');
      if (target && target !== draggedItem) {
        target.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', (e) => {
      const target = e.target.closest('li');
      if (target) {
        target.classList.remove('drag-over');
      }
    });
  });
}

window.makeListDraggable = makeListDraggable;
