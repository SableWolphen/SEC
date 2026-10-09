#!/usr/bin/env python3
"""Offline regression tests for reliable, non-fabricated, source-linked SEC news."""
import datetime as dt, json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_news as news
NOW=dt.datetime(2026,10,9,20,0,tzinfo=dt.timezone.utc)
class NewsTests(unittest.TestCase):
 def test_rss(self):
  xml=b'<rss><channel><item><title>Tennessee announces starting quarterback</title><description>Volunteers have named their starter for Saturday.</description><link>https://www.ncaa.com/news/football/fbs/article</link><pubDate>Fri, 09 Oct 2026 19:30:00 GMT</pubDate></item><item><title>Oregon defeats Washington</title><description>Big Ten update.</description><link>https://www.ncaa.com/b</link><pubDate>Fri, 09 Oct 2026 18:00:00 GMT</pubDate></item></channel></rss>'
  rows=news.from_rss(xml,NOW)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['summary'],'Volunteers have named their starter for Saturday.')
  self.assertTrue(rows[0]['breaking'])
  self.assertEqual(rows[0]['source'],'NCAA')
 def test_espn_filter_staleness(self):
  articles=[
   {'headline':'Alabama hires new coordinator','description':'Crimson Tide have made a new coaching appointment.','published':'2026-10-09T19:00:00Z','links':{'web':{'href':'https://www.espn.com/college-football/story/_/id/88'}}},
   {'headline':'Texas Tech fires coach','description':'Red Raiders changed coaches.','published':'2026-10-09T19:30:00Z','links':{'web':{'href':'https://www.espn.com/b'}}},
   {'headline':'Oklahoma wins','description':'Sooners win','published':'2026-08-05T12:00:00Z','links':{'web':{'href':'https://www.espn.com/c'}}}]
  rows=news.from_espn(json.dumps({'articles':articles}).encode(),NOW)
  self.assertEqual(len(rows),1)
  self.assertTrue(rows[0]['breaking'])
  self.assertEqual(rows[0]['teams'],['Alabama'])
 def test_sport_tags_and_national_feeds(self):
  baseball=b'<rss><channel><item><title>Tennessee baseball announces new series</title><description>The Volunteers released their SEC baseball schedule.</description><link>https://www.ncaa.com/news/baseball/d1/volunteers-schedule</link><pubDate>Fri, 09 Oct 2026 19:30:00 GMT</pubDate></item></channel></rss>'
  hoops=b'<rss><channel><item><title>Kentucky basketball releases roster</title><description>The Wildcats released their college basketball roster.</description><link>https://www.ncaa.com/news/basketball-men/d1/roster</link><pubDate>Fri, 09 Oct 2026 19:45:00 GMT</pubDate></item></channel></rss>'
  self.assertEqual(news.from_rss(baseball,NOW,'baseball')[0]['sport'],'baseball')
  self.assertEqual(news.from_rss(hoops,NOW,'basketball')[0]['sport'],'basketball')
  self.assertEqual(news.from_rss(baseball,NOW,'football')[0]['sport'],'football')
  self.assertIsNone(news.story('Tennessee wins','Volunteers', 'https://www.ncaa.com/a','2026-10-09T19:00:00Z','NCAA',NOW,'bad-sport'))
  def mock_download(url):
   if 'news/baseball/d1/rss.xml' in url:return baseball
   if 'news/basketball-men/d1/rss.xml' in url:return hoops
   raise OSError('Other feeds offline')
  rows=news.build(NOW,mock_download)['articles']
  self.assertEqual(set(row['sport'] for row in rows),{'baseball','basketball'})
  self.assertEqual(len(rows),2)
 def test_failed_sport_feed_retains_verified_history(self):
  old_story=news.story('Tennessee baseball roster announced','Volunteers baseball roster.',
                       'https://www.ncaa.com/news/baseball/d1/old',
                       '2026-10-09T18:00:00Z','NCAA',NOW,'baseball')
  fresh=b'<rss><channel><item><title>Alabama football update</title><description>Crimson Tide football game announced.</description><link>https://www.ncaa.com/news/football/fbs/new</link><pubDate>Fri, 09 Oct 2026 19:30:00 GMT</pubDate></item></channel></rss>'
  def partial(url):
   if url.endswith('/football/fbs/rss.xml'):return fresh
   raise OSError('Feed temporarily unavailable')
  result=news.build(NOW,partial,{'articles':[old_story],'sources':['NCAA']})
  self.assertEqual(set(item['sport'] for item in result['articles']),{'football','baseball'})
  self.assertIn('temporarily unavailable',result['warning'])
 def test_never_use_unsafe_links_or_undated_stories(self):
  for url in ('javascript:alert(1)','http://www.espn.com/x','https://evil.example/','https://www.espn.com.attacker.net/x'):
   self.assertIsNone(news.story('Alabama update','Alabama update',url,'2026-10-09T19:00:00Z','ESPN',NOW))
  self.assertIsNone(news.story('Alabama update','Alabama update','https://www.espn.com/x','', 'ESPN',NOW))
 def test_offline_fallback_does_not_invent(self):
  def offline(url):raise OSError('No network')
  with self.assertRaises(RuntimeError):news.build(NOW,offline)
  old={'updated_at':'2026-10-09T18:00:00Z','sources':['ESPN'],'articles':[news.story('Alabama announces hire','Alabama announced a hire.','https://www.espn.com/x','2026-10-09T18:00:00Z','ESPN',NOW)]}
  result=news.build(NOW,offline,old)
  self.assertEqual(len(result['articles']),1)
  self.assertIn('previously collected',result['warning'])
if __name__=='__main__':unittest.main()
