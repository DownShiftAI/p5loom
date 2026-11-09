# Deploying p5loom

The site is static. It is built with Node in a Docker build, then served by nginx (non-root, read-only filesystem).

Target: `https://p5loom.dawnshift.co`, on the Jarvis k3s cluster, in namespace `dawnshift-frontend`, beside the other docs apps. Ingress is Traefik over plain HTTP, the same as `developer.dawnshift.co`; TLS and the public address come from Cloudflare in front of the box.

## 1. Build the image

On the box (buildah is installed there; the cluster registry is at `10.43.23.199:5000`):

```sh
sudo buildah bud -f deploy/Dockerfile -t 10.43.23.199:5000/dawnshift/p5loom-site:0.1.4 .
sudo buildah push --tls-verify=false 10.43.23.199:5000/dawnshift/p5loom-site:0.1.4
```

The build runs `scripts/build-docs.mjs --check` first, so a broken link or an inline script fails the image build.

## 2. Apply

```sh
sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl apply -f deploy/k8s/p5loom.yaml
sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl -n dawnshift-frontend rollout status deploy/p5loom
```

The manifest only adds objects: a Deployment, a Service and an Ingress named `p5loom`. It changes nothing else in the namespace.

## 3. Public address (manual, not automated)

`p5loom.dawnshift.co` has no DNS record yet. The sibling docs hosts are Cloudflare-proxied and reach the box through its tunnel. To publish, add the hostname the same way as `developer.dawnshift.co`:

- DNS: a proxied CNAME for `p5loom` on the `dawnshift.co` zone, pointing at the box's tunnel.
- Tunnel: a public hostname `p5loom.dawnshift.co` routed to Traefik, the same route the other docs hosts use.

The automation token on this PC is invalid (Cloudflare error 9109), so these two steps were not made from here.

## 4. Verify

```sh
curl -sI https://p5loom.dawnshift.co/ | head -n 1     # HTTP/2 200
curl -s  https://p5loom.dawnshift.co/healthz          # ok
```

Check the headers include the Content-Security-Policy, and open `/playground.html` in a browser: the picture should draw.

## Rollback

```sh
sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl -n dawnshift-frontend rollout undo deploy/p5loom
```
