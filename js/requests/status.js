export function getRequestStatusIcon(status) {
  const icons = {
    new: '!',
    in_progress: '...',
    done: '✓',
    rejected: '×',
  };

  return icons[status] || '!';
}

export function getRequestStatusText(status) {
  const statuses = {
    new: 'Новая',
    in_progress: 'В работе',
    done: 'Выполнена',
    rejected: 'Отклонена',
  };

  return statuses[status] || status;
}
