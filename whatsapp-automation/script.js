let logs = [];

function connectToWhatsApp() {
  document.getElementById('qrContainer').innerHTML = '<p>Loading QR...</p>';

  fetch('/qr')
    .then(res => res.json())
    .then(data => {
      document.getElementById('qrContainer').innerHTML = `<img src="${data.qr}" />`;

      const checkStatus = setInterval(() => {
        fetch('/status')
          .then(res => res.json())
          .then(status => {
            if (status.ready) {
              clearInterval(checkStatus);
              fetch('/groups')
                .then(res => res.json())
                .then(groups => renderGroups(groups));
            }
          });
      }, 500);
    })
    .catch(() => {
      document.getElementById('qrContainer').innerHTML = '<p>QR not ready. Try again shortly.</p>';
    });
}

function renderGroups(groups) {
  let groupList = document.getElementById('groupList');
  if (!groupList) {
    groupList = document.createElement('div');
    groupList.id = 'groupList';
    const groupButtonCard = document.querySelectorAll('.card')[1];
    groupButtonCard.appendChild(groupList);
  }

  groupList.innerHTML = '';
  groupList.style.display = 'flex';
  groupList.style.flexWrap = 'wrap';
  groupList.style.gap = '10px';
  groupList.style.marginTop = '15px';

  groups.forEach(group => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.padding = '6px 10px';
    wrapper.style.border = '1px solid #00e676';
    wrapper.style.borderRadius = '6px';
    wrapper.style.backgroundColor = '#263445';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = group.name;
    checkbox.name = 'group';

    const label = document.createElement('label');
    label.textContent = group.name;
    label.style.marginLeft = '6px';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    groupList.appendChild(wrapper);
  });
}

function selectAll() {
  document.querySelectorAll('input[name="group"]').forEach(cb => cb.checked = true);
}

function deselectGroups() {
  document.querySelectorAll('input[name="group"]').forEach(cb => cb.checked = false);
}

function sendMessage() {
  const groups = Array.from(document.querySelectorAll('input[name="group"]:checked')).map(cb => cb.value);
  if (!groups.length) return alert('Please select at least one group.');

  const message = document.getElementById('messageText').value.trim();
  const meetingLink = document.getElementById('meetingLink').value.trim();
  const imageFile = document.getElementById('imageInput').files[0];
  const scheduleTime = document.getElementById('scheduleTime').value;

  const formData = new FormData();
  formData.append('groups', JSON.stringify(groups));
  formData.append('message', message);
  formData.append('meetingLink', meetingLink);
  formData.append('scheduleTime', scheduleTime);
  if (imageFile) formData.append('image', imageFile);

  fetch('/send-message', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
  alert(`Sent to: ${groups.join(', ')}`);
  logs.push({
    Group: groups.join(','),
    Message: message,
    Link: meetingLink,
    Image: data.savedImage || '',  // ✅ use saved filename from server
    Time: scheduleTime
  });
  updateLogs();
})

.catch(err => alert('Error sending: ' + err.message));
}

function updateLogs() {
  const tbody = document.getElementById('logBody');
  tbody.innerHTML = '';
  logs.forEach(log => {
    const row = document.createElement('tr');
    Object.entries(log).forEach(([key, val]) => {
      const td = document.createElement('td');
      if (key === 'Image' && val) {
        td.innerHTML = `<img src="/uploads/${val}" alt="${val}" style="max-height:40px; border-radius:4px;" />`;
      } else {
        td.textContent = val;
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
}

function downloadLogs() {
  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
    'Group,Message,Link,Image,Time\n' +
    logs.map(l => [
      `"${l.Group}"`,
      `"${l.Message.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${l.Link}"`,
      `"${l.Image}"`,
      `"${l.Time}"`
    ].join(',')).join('\n');

  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', 'sent_logs.csv');
  link.click();
}
