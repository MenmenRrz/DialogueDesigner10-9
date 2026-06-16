import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import router from '@/router'
import { type RouteLocationNormalized } from 'vue-router'

NProgress.configure({ showSpinner: false })

router.beforeEach(async (to: RouteLocationNormalized, _: RouteLocationNormalized, next: any) => {
  NProgress.start()
  next()
  NProgress.done()
})

router.afterEach(() => {
  NProgress.done()
})
