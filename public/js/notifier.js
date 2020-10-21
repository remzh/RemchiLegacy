let nt = {
  whitelisted: false, 
  ready: false, 
  update: function(){
    $.get('../notifier/status')
    .done(r => {
      nt.ready = true; 
      if(r.whitelisted){
        let s = r.status;
        nt.whitelisted = true; 
        v_nt.whitelisted = true
        v_nt.overall = s.enabled; 
        v_nt.minImportance = s.config.minImportance; 
        let types = ['email', 'text', 'push'];
        for(let i = 0; i < types.length; i++){
          if(s[types[i]]){
            if(s[types[i]]['active'] && s[types[i]]['verified']){
              v_nt[types[i]] = 3}
            else if(!s[types[i]]['active'] && s[types[i]]['verified']){
              v_nt[types[i]] = 2}
            else{
              v_nt[types[i]] = 1}
          }
        }
        if(r.status.mustUpdateCreds){
          $('#nt-mustUpdateCreds').show(); 
          rlib.toast.warn('Your notifier account requires attention.'); 
        }
      }
    })
    .fail(e => {
      rlib.toast.warn(`An error occured: ${e.response}`);
    })
  }, 
  updateCreds: function(){
    $.post('../notifier/updateCreds').done(r => {
      if(r.type === 'success'){
        rlib.toast.success('Credentials Updated!');
        $('#nt-mustUpdateCreds').hide(); 
        nt.update(); 
      }
      else{
        rlib.toast.warn(r.msg);
      }
    }).fail(e => {
      rlib.toast.warn(`An error occured: ${e.response}`);
    })
  }
}

let v_nt = new Vue({
  el: '#v-notifier-outer',
  data: {
    overall: 0,
    email: 0, 
    text: 0, 
    push: 0, 
    minImportance: '1', 
    whitelisted: nt.whitelisted, 
    currentModal: 0, // 0=email, 1=text, 2=push
    setupInput: {
      email: '', 
      carrier: 'none', 
      phone: '', 
      error: ''
    }
  }, 
  methods: {
    _status: function(inp, type) {
      if(!nt.whitelisted){
        if(!type) return 'Not Available'
        return 'grey-text' }

      let item = ['email', 'text', 'push'][inp];
      let val = this[item]; 
      switch(val){
        case 0: 
          if(!type) return 'Not Set Up'
          return 'orange-text bw'
          break;
        case 1: 
          if(!type) return 'Pending Verification'
          return 'yellow-text bw'
          break;
        case 2: 
          if(!type) return 'Disabled'
          return 'yellow-text bw'
          break;
        case 3: 
        default: 
          if(!type) return 'Active'
          return 'green-text bw'
          break; 
      }
    }, 
    _setup: function(type){
      this.currentModal = type; 
      M.Modal.getInstance($('#modal-notifier-new')[0]).open();
    }, 
    _validateSetup: function(event){
      if(this.setupInput.carrier === 'none' || this.setupInput.phone.replace(/\D/g, '').length !== 10){
        this.setupInput.error = 'One or more fields are incomplete.'
        return}
      this.setupInput.error = ''; 
      let target = $('#btn-valSetup')[0]; 
      target.disabled = true;
      target.innerHTML = `<i class='fa fa-circle-notch fa-spin'></i> Continue`
      $.post('../notifier/new', {
        type: 'text', 
        number: this.setupInput.phone, 
        carrier: this.setupInput.carrier
      }).done((r) => {
        if(r.type === 'success'){
          v_nt.text = 1; // Pending verification
          this.setupInput.phone = ''; 
          this.setupInput.carrier = 'none'; 
          M.Modal.getInstance($('#modal-notifier-new')[0]).close(); 
          M.Modal.getInstance($('#modal-notifier-verify')[0]).open(); 
        }
      }).fail((r) => {
        rlib.toast.warn(`An error occured: ${JSON.parse(res.response).error}`);
      }).always(() => {
        target.disabled = false;
        target.innerHTML = 'Continue'
      });
    }, 
    _phoneFormat: function(event){
      let ele = event.target; 
      let cur = this.setupInput.phone; 
      let raw = this.setupInput.phone.replace(/\D/g, '');
      if(raw.length === 3 && cur.slice(-1) !== ' '){
        if(ele.value.indexOf(')') === -1){
          this.setupInput.phone = `(${raw.slice(0, 3)}) ${raw.slice(3)}`}
        else if(!event.data){
          this.setupInput.phone = this.setupInput.phone.slice(0, -2)}
      }
      else if(raw.length === 6){
        if(ele.value.indexOf('-') === -1 && event.data === parseInt(event.data).toString()){
          this.setupInput.phone = `(${raw.slice(0, 3)}) ${raw.slice(3,6)}-${raw.slice(6)}`}
        else if(!event.data){
          this.setupInput.phone = this.setupInput.phone.slice(0, -1)}
      }
      else if(raw.length >= 10){
        this.setupInput.phone = `(${raw.slice(0, 3)}) ${raw.slice(3,6)}-${raw.slice(6, 10)}`
      }
    }, 
    _verifyCode: function(event){
      let code = this.setupInput.code; 
      if(!code){
        rlib.toast.error('You need to enter a code.');
      }
      if(code.length === 6){
        $.post('../notifier/verify', {
          code: code.toString()
        }).done((r) => {
          if(r.type === 'success'){
            rlib.toast.success('Your phone number has been verified.');
            v_nt.text = 3; // Verified
            v_nt.overall  = true; // Notifier is enabled
            M.Modal.getInstance($('#modal-notifier-verify')[0]).close(); 
          }
        }).fail((r) => {
          if(JSON.parse(r.response).code === 34){
            v_nt.setupInput.error = 'The verification code you entered is invalid.'}
          else{
            rlib.toast.warn(`An error occured: ${JSON.parse(r.response).error}`)}
        });
      }
      else{
        v_nt.setupInput.error = 'The verification code you entered is invalid.'}
    }, 
    _toggle: function (inp, mode){
      let item = ['email', 'text', 'push'][inp];
      $.post('../notifier/'+(mode?'enable':'disable'), {type: item})
      .done(r => {
        rlib.toast.success(`Successfully ${mode?'enabled':'disabled'} ${item} notifications.`);
        this[item] = mode?3:2;
      }).fail(r => {
        rlib.toast.error(`An error occured: ${JSON.parse(r.response).error}`);
      })
    }, 
    _updateMinImportance: function(){
      $.post('notifier/config', {
        setting: 'minImportance', 
        value: this.minImportance
      }).done(r => {
        rlib.toast.success('Notification settings updated.'); 
      }).fail(r => {
        rlib.toast.error(`An error occured: ${JSON.parse(r.response).error}`);
      })
    }
  }
}); 