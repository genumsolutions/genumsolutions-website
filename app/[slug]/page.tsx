import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'
import { getProjectCategory, PROJECT_CATEGORIES } from '../../lib/project-catalog'

export const getStaticProps = async ({ params }) => {
  const slug = (params?.slug as string) || 'robocar'
  const category = getProjectCategory(slug) ?? PROJECT_CATEGORIES.find((c) => c.slug === 'robocar')!

  return {
    props: {
      category,
      slug,
    },
    revalidate: 3600,
  }
}

export const metadata: Metadata = ({
  category,
}: {
  category?: Awaited<ReturnType<typeof getStaticProps>['props']>['category'
}) => {
  if (!category) {
    return {
      title: 'Category',
      description: 'GENUM IoT & Remote Controller project category.',
    }
  }
  return {
    title: category.name,
    description: category.description,
  }
}

export default function CategoryDescriptionPage({
  category,
  slug,
}: {
  category: Awaited<ReturnType<typeof getStaticProps>['props']>['category']
  slug: string
}) {
  return (
    <PageShell>
      <CategoryPage slug={slug} />
    </PageShell>
  )
}