(function(){
  var rows=[['Customer enquiry','“Can I book a consultation for Tuesday?”'],['AI agent response','“Which service do you need, and what time works for you?”'],['Customer record','New enquiry · Consultation · Tuesday · Awaiting availability'],['Team handoff','Check availability and confirm the appointment, with the enquiry details attached.']];
  document.querySelectorAll('[data-system]').forEach(function(button){button.addEventListener('click',function(){var row=rows[Number(button.dataset.system)];document.getElementById('demo-label').textContent=row[0];document.getElementById('demo-value').textContent=row[1];});});
})();
