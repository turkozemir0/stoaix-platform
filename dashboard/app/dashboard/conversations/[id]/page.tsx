import { redirect } from 'next/navigation'

// Lead detay sayfası /dashboard/leads/[id]'e taşındı
export default function ConversationRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/leads/${params.id}`)
}
