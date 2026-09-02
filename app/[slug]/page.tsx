import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'
import {
  getProjectCategory,
  PROJECT_CATEGORIES,
  type ProjectCategory,
} from '../../lib/project-catalog'

const SLUGS = PROJECT_CATEGORIES.map((c) => c.slug)

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const category = getProjectCategory(params.slug)
  if (!category) return {}
  return {
    title: category.name,
    description: category.description,
  }
}

export default function CategoryDescriptionPage({ params }: { params: { slug: string } }) {
  const category: ProjectCategory | undefined = getProjectCategory(params.slug)
  if (!category) notFound()

  return (
    <PageShell>
      <CategoryPage slug={category.slug} />
    </PageShell>
  )
}
