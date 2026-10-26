import { FormHeaderBand } from "@/components/public/form-header-band";

export default function PublicNotFound() {
  return (
    <div className="sk-card w-full">
      <FormHeaderBand
        title="Form not found"
        description="This form does not exist or may have been removed."
      />
      <div className="px-5 pt-6 pb-7 sm:px-10 sm:pt-9 sm:pb-10 text-center">
        <p className="text-[15px] leading-6 text-[var(--muted)]">
          The link you followed may be broken or the form may have been removed by the owner.
        </p>
      </div>
    </div>
  );
}
