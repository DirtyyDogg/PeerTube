import { Component, OnInit, ViewChild } from '@angular/core'
import { UserRight } from '../../../../shared/models/users/user-right.enum'
import { AuthService, AuthStatus, RedirectService, ServerService } from '../core'
import { User } from '@app/shared/users/user.model'
import { UserService } from '@app/shared/users/user.service'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { HotkeysService } from 'angular2-hotkeys'
import { ServerConfig, VideoConstant } from '@shared/models'
import { QuickSettingsModalComponent } from '@app/modal/quick-settings-modal.component'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ]
})
export class MenuComponent implements OnInit {
  @ViewChild('languageChooserModal', { static: true }) languageChooserModal: LanguageChooserComponent
  @ViewChild('quickSettingsModal', { static: true }) quickSettingsModal: QuickSettingsModalComponent

  user: User
  isLoggedIn: boolean

  userHasAdminAccess = false
  helpVisible = false

  videoLanguages: string[] = []

  private languages: VideoConstant<string>[] = []
  private serverConfig: ServerConfig
  private routesPerRight: { [ role in UserRight ]?: string } = {
    [UserRight.MANAGE_USERS]: '/admin/users',
    [UserRight.MANAGE_SERVER_FOLLOW]: '/admin/friends',
    [UserRight.MANAGE_VIDEO_ABUSES]: '/admin/moderation/video-abuses',
    [UserRight.MANAGE_VIDEO_BLACKLIST]: '/admin/moderation/video-blacklist',
    [UserRight.MANAGE_JOBS]: '/admin/jobs',
    [UserRight.MANAGE_CONFIGURATION]: '/admin/config'
  }

  constructor (
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.isLoggedIn = this.authService.isLoggedIn()
    if (this.isLoggedIn === true) this.user = this.authService.getUser()
    this.computeIsUserHasAdminAccess()

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true
          this.user = this.authService.getUser()
          this.computeIsUserHasAdminAccess()
          console.log('Logged in.')
        } else if (status === AuthStatus.LoggedOut) {
          this.isLoggedIn = false
          this.user = undefined
          this.computeIsUserHasAdminAccess()
          console.log('Logged out.')
        } else {
          console.error('Unknown auth status: ' + status)
        }
      }
    )

    this.hotkeysService.cheatSheetToggle
        .subscribe(isOpen => this.helpVisible = isOpen)

    this.serverService.getVideoLanguages()
        .subscribe(languages => {
          this.languages = languages

          this.authService.userInformationLoaded
              .subscribe(() => this.buildUserLanguages())
        })
  }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get nsfwPolicy () {
    if (!this.user) return

    switch (this.user.nsfwPolicy) {
      case 'do_not_list':
        return this.i18n('hide')

      case 'blur':
        return this.i18n('blur')

      case 'display':
        return this.i18n('display')
    }
  }

  isRegistrationAllowed () {
    return this.serverConfig.signup.allowed &&
           this.serverConfig.signup.allowedForCurrentIP
  }

  getFirstAdminRightAvailable () {
    const user = this.authService.getUser()
    if (!user) return undefined

    const adminRights = [
      UserRight.MANAGE_USERS,
      UserRight.MANAGE_SERVER_FOLLOW,
      UserRight.MANAGE_VIDEO_ABUSES,
      UserRight.MANAGE_VIDEO_BLACKLIST,
      UserRight.MANAGE_JOBS,
      UserRight.MANAGE_CONFIGURATION
    ]

    for (const adminRight of adminRights) {
      if (user.hasRight(adminRight)) {
        return adminRight
      }
    }

    return undefined
  }

  getFirstAdminRouteAvailable () {
    const right = this.getFirstAdminRightAvailable()

    return this.routesPerRight[right]
  }

  logout (event: Event) {
    event.preventDefault()

    this.authService.logout()
    // Redirect to home page
    this.redirectService.redirectToHomepage()
  }

  openLanguageChooser () {
    this.languageChooserModal.show()
  }

  openHotkeysCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.helpVisible)
  }

  openQuickSettings () {
    this.quickSettingsModal.show()
  }

  toggleUseP2P () {
    if (!this.user) return
    this.user.webTorrentEnabled = !this.user.webTorrentEnabled

    this.userService.updateMyProfile({ webTorrentEnabled: this.user.webTorrentEnabled })
        .subscribe(() => this.authService.refreshUserInformation())
  }

  langForLocale (localeId: string) {
    return this.languages.find(lang => lang.id === localeId).label
  }

  private buildUserLanguages () {
    if (!this.user) {
      this.videoLanguages = []
      return
    }

    if (!this.user.videoLanguages) {
      this.videoLanguages = [ this.i18n('any language') ]
      return
    }

    this.videoLanguages = this.user.videoLanguages
                              .map(locale => this.langForLocale(locale))
                              .map(value => value === undefined ? '?' : value)
  }

  private computeIsUserHasAdminAccess () {
    const right = this.getFirstAdminRightAvailable()

    this.userHasAdminAccess = right !== undefined
  }
}
