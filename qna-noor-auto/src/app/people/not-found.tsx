import { Card, CardBody, LinkButton } from "@/components/ui";

export default function PeopleNotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardBody className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            404
          </p>
          <h1 className="text-xl font-semibold text-zinc-900">
            Profile not found
          </h1>
          <p className="text-sm text-zinc-600">
            This profile isn’t available.
          </p>
          <LinkButton href="/people" variant="secondary">
            Back to People
          </LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}
