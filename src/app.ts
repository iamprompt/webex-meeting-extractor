import axios, { AxiosRequestConfig } from 'axios'
import express, { Application, Request, Response, Router } from 'express'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs().format()
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
dayjs.tz.setDefault('Asia/Bangkok')

const app: Application = express()
const router: Router = express.Router()
app.use('/', router)
router.use(express.json())
router.use(express.urlencoded({ extended: true }))

router.get('/', (req: Request, res: Response) => {
  res.send('Hello World!')
})

router.get('/webexMeetingRoom', async (req: Request, res: Response) => {
  console.log(req.query)
  const { meetingId, password: meetingPass } = req.query
  console.log(`Meeting Id: ${meetingId} Password: ${meetingPass}`)

  const roomCheck = await axios
    .get('https://mahidol.webex.com/webappng/api/v1/meetings?siteurl=mahidol', {
      headers: {
        meetingUri: meetingId,
        Host: 'webex.com',
      },
    })
    .then((v) => v.data)

  // console.log(roomCheck)

  const { uuid: roomId } = roomCheck
  console.log(roomId)

  const roomInfo = await axios
    .get(
      `https://mahidol.webex.com/webappng/api/v1/meetings/${roomId}?siteurl=mahidol`,
      {
        headers: {
          password: meetingPass,
          Host: 'webex.com',
          captchaID: 'Captcha_3b540393-802d-4d9b-aa97-010d91f1837f',
          verifyCode: 'q6hpmq',
        },
      },
    )
    .then((v) => {
      const d = v.data
      console.log(d)

      const hosts = [{ name: d.hostDisplayName, email: d.hostName }]

      d.alternateHosts.forEach((host) => {
        hosts.push({
          name: host.alternateHostName,
          email: host.alternateHostEmail,
        })
      })

      const duration = d.scheduledDuration // Minutes

      const startTime = dayjs(d.startTime)
      const endTime = startTime.add(duration, 'minutes')

      const occurencesObjTemp = {}
      d.dtStart.split(';').forEach((s) => {
        const [key, value] = s.split('=')
        occurencesObjTemp[key] = value
      })

      d.rrule.split(';').forEach((s) => {
        const [key, value] = s.split('=')
        occurencesObjTemp[key] = value
      })

      console.log(occurencesObjTemp)

      const occurencesObj = {
        freq: occurencesObjTemp['FREQ'],
        dayRepeat: occurencesObjTemp['BYDAY'],
      }
      occurencesObj['occurencesStart'] = dayjs(
        occurencesObjTemp['TZID'].split(':')[1],
        'YYYYMMDDThhmmss',
      ).format()

      occurencesObj['occurencesEnd'] = occurencesObjTemp['UNTIL']
        ? dayjs(occurencesObjTemp['UNTIL'], 'YYYYMMDD')
            .set('hour', endTime.get('hour'))
            .set('minute', endTime.get('minute'))
            .format()
        : undefined

      return {
        meetingKey: d.meetingKey,
        meetingPassword: d.password,
        uuid: d.uuid,
        meetingTopic: d.meetingTopic.replace(/[\n\t]/, ''),
        startTime: startTime.format(),
        endTime: endTime.format(),
        duration: duration,
        occurences: occurencesObj,
        meetingLink: d.meetingLink,
        hosts: hosts,
      }
    })

  console.log(roomInfo)

  return res.send({ status: 'success', payload: roomInfo })
})

app.listen(3000, () => console.log('Listening at port 3000'))
