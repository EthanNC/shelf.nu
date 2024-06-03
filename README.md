# Shelf.sst

This is a fork of the open source project [Shelf.nu](github.com/Shelf-nu/shelf.nu), which aims to deploy the project using the Ion engine developed by [SST](https://ion.sst.dev/). The goal is to have a full-stack deployment using the SST framework on AWS infrastructure.

Shelf.nu uses [Supabase](https://supabase.com/) for the backend database, image storage, and authentication provider. The work done so far has been to replace the authentication and file storage layer with [Lucia](https://github.com/lucia-auth/lucia) and S3 respectively. The Supabase provided PostgresDB is still used for the database as it most affordable database solution currently available.

## Key Changes

- Provision the PostgresDB using [pulumi-supabase](https://github.com/sst/pulumi-supabase)
- Removed Supabase authentication and replaced with Lucia
- Removed Supabase Storage and replaced with S3 Buckets
- Deploy the Remix application to AWS Cloudfront

## Things to do

- Make Playwright test environment work
- replace the SSE powered notification system with an AWS PUB/SUB system
- Shelf.nu beta Booking System uses [pg-boss](https://github.com/timgit/pg-boss) as a job queue. This can be replaced with SST [Queue](https://ion.sst.dev/docs/component/aws/queue/)

<a href="https://www.shelf.nu/" target="_blank">
<img width="100%" src="./public/static/images/readme-cover.jpg" />
</a>
<h4 align="center">
✨ Open Source Asset Management Infrastructure for everyone. ✨
</h4>
<p align="center" >
Shelf 🏷️ Asset Management infrastructure for absolutely everyone (open source).<br/> <br/>
Shelf is a simple and visual asset management and location tracking system that allows people to track their physical assets with ease.
</p>

## Core Features and Benefits 💫

With Shelf, you can take a picture of any item you own and store it in your own database. From there, you can generate a printable code (QR) that you can tag onto the item, making it easy to identify and locate in the future. Shelf has a handy code printing area where you can add as many QR codes as you can on an A4 sticker paper sheet. You can also add detailed information about the item, including its purchase date, purchase price, warranty information, and more.

<div align="left">

<p align="center">
    <a href="https://www.shelf.nu/?ref=github" target="_blank"><b>Website</b></a> •
    <a href="https://github.com/Shelf-nu/shelf.nu/tree/main/docs" target="_blank"><b>Documentation</b></a> •
    <a href="https://discord.gg/gdPMsSzqCS" target="_blank"><b>Join our Community</b></a> • 
    <a href="https://twitter.com/ShelfQR/?ref=github" target="_blank"><b>Twitter</b></a>
</p>

<div align = "center">
    
[![Shelf.nu Discord](https://dcbadge.vercel.app/api/server/gdPMsSzqCS)](https://discord.gg/gdPMsSzqCS)

</div>

### Once your assets are online, you will be able to:

- Generate printable PDFs sheets from assets you select, so you can stick them onto anything
- Check the last known location of your assets
- Instant Search through your assets database
- Use 'lost mode' for emergencies (offer a bounty for a return of an item)
- Get notified of assets you are not using
- Share your asset vault with other users

### Use Shelf alone, or as a team. And, these questions will be a thing of the past.

- Who was the last person that took X,Y or Z?
- What gear does X have currently?
- Which assets did we appoint to our team member abroad?
- What do we have in our storage facility now?

### Looking for contributing in Shelf?

- check out our [contributing guidelines](./CONTRIBUTING.md)
