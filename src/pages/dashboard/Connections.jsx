import { INSTAGRAM_ENABLED } from '../../lib/config'
import { PageHeading } from './DashboardLayout'
import { ConnectedAccountsCard, InstagramCard } from './Settings'

/** Where creators connect the accounts that automations and the post scheduler work on */
export default function Connections() {
  return (
    <div className="space-y-4">
      <PageHeading title="Connect your accounts." italic="Then automate them.">
        Connect Instagram for DM automation and post scheduling, and LinkedIn and YouTube to post to them from Schedule posts.
      </PageHeading>
      {INSTAGRAM_ENABLED && <InstagramCard />}
      <ConnectedAccountsCard />
    </div>
  )
}
