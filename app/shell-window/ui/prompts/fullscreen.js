import * as yo from 'yo-yo'
// import { ??? } from 'electron'
import * as promptbar from '../promptbar'

// constants
// =

const FULLSCREEN_WARNING_TIME = 2000

// exported api
// =

export default function () {
  return {
    type: 'fullscreen',
    render: () => { 
      const onClickClose = () => {
        console.log('sending leave-full-screen')
        // ???.send('window-event', 'leave-full-screen')
      }
      const alertInitial = yo`
        <div onclick=${onClickClose} class='prompt push-to-front'>
          <span>Going fullscreen !</span>
          <button>EXIT</button>
        </div>`
      const alertPersistent = yo`
        <div onclick=${onClickClose} class='prompt'>
          <span>Fullscreen</span>
          <button>EXIT</button>
      </div>`

      setTimeout(() => yo.update(alertInitial, alertPersistent), FULLSCREEN_WARNING_TIME)
      return alertInitial
    }
  }
}

