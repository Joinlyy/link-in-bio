import { useAuth } from '../../context/AuthContext'
import ChatThread from '../../components/ChatThread'
import { Card } from '../../components/ui'
import { PageHeading } from './DashboardLayout'

export default function Support() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <PageHeading title="Messages." italic="Talk to our team.">Report a problem, ask for a feature or appeal a decision. Replies show up here live.</PageHeading>
      <Card className="overflow-hidden">
        <ChatThread creatorId={user.id} as="creator" className="h-[min(640px,calc(100dvh-16rem))]" />
      </Card>
    </div>
  )
}
