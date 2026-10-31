import { buttonVariants } from './buttonStyles.js'

export default function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />
}
